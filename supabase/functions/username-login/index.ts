import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BODY_BYTES = 8_192;
const MAX_PASSWORD_LENGTH = 1_024;

function allowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("PFSS_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

async function hashRateLimitKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const origins = allowedOrigins();

  if (origin && !origins.has(origin)) {
    return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }
  if (req.headers.get("content-type")?.toLowerCase().split(";")[0].trim() !== "application/json") {
    return json(req, { error: "Content-Type must be application/json" }, 415);
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(req, { error: "Request body too large" }, 413);
  }

  let payload: unknown;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json(req, { error: "Request body too large" }, 413);
    }
    payload = JSON.parse(raw);
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json(req, { error: "Invalid request body" }, 400);
  }

  try {
    const input = payload as Record<string, unknown>;
    const normalizedUsername = typeof input.username === "string" ? input.username.trim() : "";
    const suppliedPassword = typeof input.password === "string" ? input.password : "";

    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(normalizedUsername) ||
        suppliedPassword.length < 1 ||
        suppliedPassword.length > MAX_PASSWORD_LENGTH) {
      return json(req, { error: "Invalid credentials" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const publishableKey = publishableKeys.default;
    const secretKey = secretKeys.default;

    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("Username login function is missing required runtime configuration.");
      return json(req, { error: "Login service unavailable" }, 503);
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Use the client address supplied by Cloudflare at the edge. Do not trust
    // the first X-Forwarded-For entry, which a caller may be able to spoof.
    const clientIp = req.headers.get("cf-connecting-ip")?.trim() ?? "";
    if (!clientIp || clientIp.length > 64 || !/^[0-9a-fA-F:.]+$/.test(clientIp)) {
      console.error("Trusted client IP is unavailable for username login rate limiting.");
      return json(req, { error: "Login service unavailable" }, 503);
    }

    // Two distributed counters prevent both one-source abuse and targeted
    // account lockout: one is per IP, the other per username/IP pair.
    // Fail closed if the migration/RPC is not installed or unavailable.
    const rateLimitKeys = [
      { key: await hashRateLimitKey("ip:" + clientIp), maxAttempts: 30 },
      { key: await hashRateLimitKey("user-ip:" + normalizedUsername.toLowerCase() + ":" + clientIp), maxAttempts: 8 },
    ];
    for (const limit of rateLimitKeys) {
      const { data: limitResult, error: limitError } = await adminClient
        .rpc("pfss_consume_username_login_limit", {
          p_key_hash: limit.key,
          p_max_attempts: limit.maxAttempts,
          p_window_seconds: 900,
        })
        .maybeSingle();

      if (limitError || !limitResult) {
        console.error("Username login rate-limit service is unavailable.");
        return json(req, { error: "Login service unavailable" }, 503);
      }
      if (!limitResult.allowed) {
        return json(
          { error: "Too many login attempts. Please try again later." },
          429,
          { "Retry-After": String(limitResult.retry_after_seconds) },
        );
      }
    }

    // Resolve the username only on the server; never return the account email.
    const { data: profile, error: lookupError } = await adminClient
      .from("profiles")
      .select("id")
      .ilike("username", normalizedUsername.replace(/([%_\\])/g, "\\$1"))
      .maybeSingle();

    if (lookupError || !profile) {
      return json(req, { error: "Invalid credentials" }, 401);
    }

    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(profile.id);

    if (userError || !userData.user?.email) {
      return json(req, { error: "Invalid credentials" }, 401);
    }

    const { data: sessionData, error: signInError } = await createClient(
      supabaseUrl,
      publishableKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    ).auth.signInWithPassword({
      email: userData.user.email,
      password: suppliedPassword,
    });

    if (signInError || !sessionData.session) {
      return json(req, { error: "Invalid credentials" }, 401);
    }

    return json(req, {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      token_type: sessionData.session.token_type,
      expires_in: sessionData.session.expires_in,
      expires_at: sessionData.session.expires_at,
      user: sessionData.user,
    });
  } catch {
    // Do not log submitted usernames, passwords, tokens, or provider error bodies.
    console.error("Username login request failed.");
    return json(req, { error: "Login service unavailable" }, 500);
  }
});
