import { AwsClient } from "npm:aws4fetch@1.0.20";
import { corsForRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = corsForRequest(req, "GET, POST, OPTIONS");
  const json = (body: Record<string, unknown>, status = 200) =>
    Response.json(body, { status, headers: cors.headers });

  if (!cors.allowed) {
    return json({ ok: false, message: "Origin not allowed." }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors.headers });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed" }, 405);
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
      return json({
        ok: false,
        message: "Required Supabase secrets are missing.",
        missing,
      }, 500);
    }

    const expectedEndpoint = \`https://\${accountId}.r2.cloudflarestorage.com\`;
    if (endpoint !== expectedEndpoint) {
      return json({
        ok: false,
        message: "R2_ENDPOINT does not match the Cloudflare account endpoint.",
      }, 500);
    }

    const client = new AwsClient({
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
      service: "s3",
      region: "auto",
    });

    const url = new URL(\`\${endpoint}/\${encodeURIComponent(bucket!)}\`);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("max-keys", "1");

    const response = await client.fetch(url.toString(), {
      method: "GET",
      headers: { "x-amz-content-sha256": "UNSIGNED-PAYLOAD" },
    });

    if (!response.ok) {
      // Do not return provider response bodies or credential-related details.
      return json({
        ok: false,
        message: response.status === 403
          ? "Cloudflare rejected the credentials or bucket permissions (HTTP 403)."
          : response.status === 404
          ? "The R2 bucket or endpoint was not found (HTTP 404)."
          : \`Cloudflare R2 returned HTTP \${response.status}.\`,
      }, 502);
    }

    return json({
      ok: true,
      message: "Supabase can reach the R2 bucket and list its contents.",
      bucket,
    });
  } catch (_error) {
    return json({
      ok: false,
      message: "The R2 connection test failed. Check the Edge Function logs.",
    }, 500);
  }
});
