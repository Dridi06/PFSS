import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Ratelimit } from "npm:@upstash/ratelimit@^2";
import { Redis } from "npm:@upstash/redis@^1";
import { corsForRequest } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const cors = corsForRequest(req, "POST, OPTIONS");
  const json = (
    body: Record<string, unknown>,
    status = 200,
    extraHeaders: Record<string, string> = {},
  ) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors.headers,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    });

  if (!cors.allowed) {
    return json({ error: "Origin not allowed" }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors.headers });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > 8192) {
      return json({ error: "Invalid credentials" }, 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid credentials" }, 400);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json({ error: "Invalid credentials" }, 400);
    }
    const { username, password } = payload as Record<string, unknown>;
    if (typeof username !== "string" || typeof password !== "string") {
      return json({ error: "Invalid credentials" }, 400);
    }
    const normalizedUsername = username.trim().toLowerCase();
    const suppliedPassword = password;

    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(normalizedUsername) ||
        suppliedPassword.length < 1 || suppliedPassword.length > 1024) {
      return json({ error: "Invalid credentials" }, 400);
    }

    // Rate-limit by a keyed digest so raw usernames never become Redis keys.
    // Do not trust caller-controlled forwarding headers as an IP identity.
    const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    const rateLimitHmacKey = Deno.env.get("PFMS_RATE_LIMIT_HMAC_KEY");
    if (!redisUrl || !redisToken || !rateLimitHmacKey ||
        rateLimitHmacKey.length < 32) {
      console.error("Username login rate-limit service is not configured.");
      return json({ error: "Login service temporarily unavailable" }, 503);
    }

    const hmacKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(rateLimitHmacKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const usernameDigest = await crypto.subtle.sign(
      "HMAC",
      hmacKey,
      new TextEncoder().encode(normalizedUsername),
    );
    const rateLimitIdentifier = Array.from(new Uint8Array(usernameDigest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const limiter = new Ratelimit({
      redis: new Redis({ url: redisUrl, token: redisToken }),
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: false,
      prefix: "pfms:username-login",
    });

    const tooManyAttempts = (reset: number) => {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return json(
        { error: "Too many login attempts. Please try again later." },
        429,
        { "Retry-After": String(retryAfter) },
      );
    };

    // Only failed credentials consume the account-specific allowance.
    const invalidCredentials = async () => {
      try {
        const failedAttempt = await limiter.limit(rateLimitIdentifier);
        return failedAttempt.success
          ? json({ error: "Invalid credentials" }, 400)
          : tooManyAttempts(failedAttempt.reset);
      } catch (rateLimitError) {
        console.error("Username login failure counter failed:", rateLimitError);
        return json({ error: "Login service temporarily unavailable" }, 503);
      }
    };

    try {
      const remaining = await limiter.getRemaining(rateLimitIdentifier);
      if (remaining.remaining <= 0) {
        return tooManyAttempts(remaining.reset);
      }
    } catch (rateLimitError) {
      console.error("Username login rate-limit check failed:", rateLimitError);
      return json({ error: "Login service temporarily unavailable" }, 503);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKeys = JSON.parse(
      Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}",
    );
    const secretKeys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    );
    const publishableKey = publishableKeys.default;
    const secretKey = secretKeys.default;

    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("Username login function is missing Supabase runtime keys.");
      return json({ error: "Login service unavailable" }, 500);
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Resolve the username only on the server; never return the account email.
    const { data: profile, error: lookupError } = await adminClient
      .from("profiles")
      .select("id")
      .ilike("username", normalizedUsername.replace(/([%_\\])/g, "\\$1"))
      .maybeSingle();

    if (lookupError || !profile) {
      return await invalidCredentials();
    }

    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(profile.id);

    if (userError || !userData.user?.email) {
      return await invalidCredentials();
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
      return await invalidCredentials();
    }

    return json({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      token_type: sessionData.session.token_type,
      expires_in: sessionData.session.expires_in,
      expires_at: sessionData.session.expires_at,
    });
  } catch (error) {
    console.error("Username login request failed:", error);
    return json({ error: "Login service unavailable" }, 500);
  }
});
