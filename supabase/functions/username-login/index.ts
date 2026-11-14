import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsForRequest } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const cors = corsForRequest(req, "POST, OPTIONS");
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors.headers,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
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
    const normalizedUsername = username.trim();
    const suppliedPassword = password;

    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(normalizedUsername) ||
        suppliedPassword.length < 1 || suppliedPassword.length > 1024) {
      return json({ error: "Invalid credentials" }, 400);
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
      return json({ error: "Invalid credentials" }, 400);
    }

    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(profile.id);

    if (userError || !userData.user?.email) {
      return json({ error: "Invalid credentials" }, 400);
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
      return json({ error: "Invalid credentials" }, 400);
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
