import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsForRequest } from "../_shared/cors.ts";

function sha256Hex(value: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
    .then((digest) => Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  const cors = corsForRequest(req, "POST, OPTIONS");
  const json = (body: Record<string, unknown>, status = 200) =>
    Response.json(body, {
      status,
      headers: { ...cors.headers, "Cache-Control": "no-store" },
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
    const authorization = req.headers.get("authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) {
      return json({ error: "Authentication required" }, 401);
    }

    const rawBody = await req.text();
    if (rawBody.length > 4096) {
      return json({ error: "Invalid bootstrap request" }, 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid bootstrap request" }, 400);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json({ error: "Invalid bootstrap request" }, 400);
    }

    const bootstrapToken = (payload as Record<string, unknown>).bootstrap_token;
    if (typeof bootstrapToken !== "string" ||
        bootstrapToken.length < 40 || bootstrapToken.length > 512) {
      return json({ error: "Invalid bootstrap token" }, 403);
    }

    const expectedToken = Deno.env.get("PFMS_OWNER_BOOTSTRAP_TOKEN");
    if (!expectedToken || expectedToken.length < 40) {
      console.error("PFMS owner bootstrap secret is not configured or is too short.");
      return json({ error: "Owner setup is not configured" }, 503);
    }

    const [providedHash, expectedHash] = await Promise.all([
      sha256Hex(bootstrapToken),
      sha256Hex(expectedToken),
    ]);
    if (!constantTimeEqual(providedHash, expectedHash)) {
      return json({ error: "Invalid bootstrap token" }, 403);
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
      console.error("PFMS owner bootstrap function is missing Supabase runtime keys.");
      return json({ error: "Owner setup is unavailable" }, 500);
    }

    // Verify the caller's JWT with Supabase; never accept a user ID from the request body.
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Authentication required" }, 401);
    }

    // The first owner must have confirmed the account's email and must have
    // registered through the dedicated owner onboarding choice.
    if (!userData.user.email || !userData.user.email_confirmed_at ||
        userData.user.user_metadata?.registration_type !== "owner_bootstrap") {
      return json({ error: "Verified owner registration required" }, 403);
    }

    const serviceClient = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { error: claimError } = await serviceClient.rpc(
      "pfms_claim_initial_owner",
      { p_user_id: userData.user.id },
    );

    if (claimError) {
      console.error("PFMS initial owner claim failed:", claimError.message);
      return json({
        error: "Owner setup is unavailable or has already been completed.",
      }, 409);
    }

    return json({
      ok: true,
      message: "PFMS platform owner was successfully configured.",
    });
  } catch (error) {
    console.error("PFMS owner bootstrap request failed:", error);
    return json({ error: "Owner setup is temporarily unavailable" }, 500);
  }
});
