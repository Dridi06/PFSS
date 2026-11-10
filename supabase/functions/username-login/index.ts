import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { username, password } = await req.json();
    const normalizedUsername = String(username ?? "").trim();
    const suppliedPassword = String(password ?? "");

    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(normalizedUsername) ||
        suppliedPassword.length < 1) {
      return json({ error: "Invalid credentials" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Username login function is missing required Supabase secrets.");
      return json({ error: "Login service unavailable" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: lookupError } = await adminClient
      .from("profiles")
      .select("id")
      .ilike("username", normalizedUsername)
      .maybeSingle();

    if (lookupError || !profile) {
      return json({ error: "Invalid credentials" }, 400);
    }

    const authResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${profile.id}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );

    if (!authResponse.ok) {
      console.error("Username login could not resolve the account.");
      return json({ error: "Invalid credentials" }, 400);
    }

    const authUser = await authResponse.json();
    if (!authUser.email) {
      return json({ error: "Invalid credentials" }, 400);
    }

    const tokenResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authUser.email,
          password: suppliedPassword,
        }),
      },
    );

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return json({ error: "Invalid credentials" }, 400);
    }

    return json(tokenData);
  } catch (error) {
    console.error("Username login request failed:", error);
    return json({ error: "Login service unavailable" }, 500);
  }
});
