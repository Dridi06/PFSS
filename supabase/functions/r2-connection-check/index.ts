import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return Response.json({ ok: false, message: "Method not allowed" }, {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
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
      return Response.json({
        ok: false,
        message: "Required Supabase secrets are missing.",
        missing,
      }, { status: 500, headers: corsHeaders });
    }

    const expectedEndpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    if (endpoint !== expectedEndpoint) {
      return Response.json({
        ok: false,
        message: "R2_ENDPOINT does not match the Cloudflare account endpoint.",
      }, { status: 500, headers: corsHeaders });
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

    const response = await client.fetch(url.toString(), {
      method: "GET",
      headers: { "x-amz-content-sha256": "UNSIGNED-PAYLOAD" },
    });

    if (!response.ok) {
      // Do not return provider response bodies or credential-related details.
      return Response.json({
        ok: false,
        message: response.status === 403
          ? "Cloudflare rejected the credentials or bucket permissions (HTTP 403)."
          : response.status === 404
          ? "The R2 bucket or endpoint was not found (HTTP 404)."
          : `Cloudflare R2 returned HTTP ${response.status}.`,
      }, { status: 502, headers: corsHeaders });
    }

    return Response.json({
      ok: true,
      message: "Supabase can reach the R2 bucket and list its contents.",
      bucket: bucket,
    }, { headers: corsHeaders });
  } catch (_error) {
    return Response.json({
      ok: false,
      message: "The R2 connection test failed. Check the Edge Function logs.",
    }, { status: 500, headers: corsHeaders });
  }
});
