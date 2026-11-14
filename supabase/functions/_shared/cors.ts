const DEFAULT_ALLOWED_ORIGINS = [
  "https://pfss-scouting.onrender.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";

function allowedOrigins(): Set<string> {
  const configured = Deno.env.get("PFMS_ALLOWED_ORIGINS");
  const entries = configured
    ? configured.split(",").map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;

  return new Set(entries.map((entry) => {
    try {
      const parsed = new URL(entry);
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        return "";
      }
      return parsed.origin;
    } catch {
      return "";
    }
  }).filter(Boolean));
}

/**
 * CORS is an origin allowlist, not an authentication mechanism.
 * Requests without an Origin header are allowed for server-to-server clients;
 * authenticated Edge Functions must still validate their JWT/permissions.
 */
export function corsForRequest(
  req: Request,
  allowedMethods: string,
): { allowed: boolean; headers: Record<string, string> } {
  const origin = req.headers.get("origin");
  const origins = allowedOrigins();
  const allowed = !origin || origins.has(origin);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": allowedMethods,
    "Vary": "Origin",
  };

  if (origin && allowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return { allowed, headers };
}
