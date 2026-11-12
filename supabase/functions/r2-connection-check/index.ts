import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

function allowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("PFSS_ALLOWED_ORIGINS") ?? "")
      .split(",").map((origin) => origin.trim()).filter(Boolean),
  );
}

function cors(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const origin = req.headers.get("origin");
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function reply(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().has(origin)) {
    return new Response(null, { status: 403, headers: { "Vary": "Origin" } });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return reply(req, { ok: false, message: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const publishableKey = publishableKeys.default;
    const tokenMatch = (req.headers.get("authorization") ?? "").match(/^Bearer\s+([^\s]+)$/i);
    const configuredAdmins = (Deno.env.get("PFSS_R2_ADMIN_USER_IDS") ?? "")
      .split(",").map((value) => value.trim()).filter(Boolean);

    if (!supabaseUrl || !publishableKey || configuredAdmins.length === 0) {
      console.error("R2 diagnostics are missing required authorization configuration.");
      return reply(req, { ok: false, message: "R2 diagnostics are not configured." }, 503);
    }
    if (!tokenMatch) {
      return reply(req, { ok: false, message: "Authentication required." }, 401);
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(tokenMatch[1]);
    if (authError || !authData.user) {
      return reply(req, { ok: false, message: "Authentication required." }, 401);
    }
    if (!configuredAdmins.includes(authData.user.id)) {
      return reply(req, { ok: false, message: "Administrator access required." }, 403);
    }

    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_NAME");
    const endpoint = Deno.env.get("R2_ENDPOINT")?.replace(/\/+$/, "");

    const missing = [
      ["CLOUDFLARE_ACCOUNT_ID", accountId],
      ["R2_ACCESS_KEY_ID", accessKeyId],
      ["R2_SECRET_ACCESS_KEY", secretAccessKey],
      ["R2_BUCKET_NAME", bucket],
      ["R2_ENDPOINT", endpoint],
    ].filter(([, value]) => !value).map(([key]) => key);

    if (missing.length) {
      return reply(req, { ok: false, message: "Required Supabase secrets are missing.", missing }, 503);
    }

    const expectedEndpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    if (endpoint !== expectedEndpoint) {
      return reply(req, { ok: false, message: "R2_ENDPOINT does not match the Cloudflare account endpoint." }, 503);
    }

    const client = new AwsClient({
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
      service: "s3",
      region: "auto",
    });
    const url = new URL(`${endpoint}/${encodeURIComponent(bucket!)}`);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("max-keys", "1");

    const upstream = await client.fetch(url.toString(), {
      method: "GET",
      headers: { "x-amz-content-sha256": "UNSIGNED-PAYLOAD" },
    });
    if (!upstream.ok) {
      return reply(req, {
        ok: false,
        message: upstream.status === 403
          ? "Cloudflare rejected the credentials or bucket permissions (HTTP 403)."
          : upstream.status === 404
          ? "The R2 bucket or endpoint was not found (HTTP 404)."
          : `Cloudflare R2 returned HTTP ${upstream.status}.`,
      }, 502);
    }

    return reply(req, {
      ok: true,
      message: "Supabase can reach the R2 bucket and list its contents.",
      bucket,
    });
  } catch {
    console.error("R2 connection diagnostics failed.");
    return reply(req, { ok: false, message: "The R2 connection test failed. Check the Edge Function logs." }, 500);
  }
});
