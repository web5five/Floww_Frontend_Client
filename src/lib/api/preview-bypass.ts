import "server-only";

const ownedPath = /^\/(?:actuator\/health|api\/v1\/(?:auth\/wallet\/(?:nonce|verify)|auth\/signout|users\/me)|api\/(?:integrations\/readiness|ai\/drafts))$|^\/(?:api\/v1\/tasks|api\/executions)(?:\/|$)/;

/** Only the validated Floww backend receives the optional Preview credential. */
export function previewBypassHeader(target: URL): Record<string, string> {
  const secret = process.env.FLOWW_SERVER_VERCEL_BYPASS_SECRET;
  if (!secret || secret.trim() !== secret || /[\r\n]/.test(secret)) return {};
  try {
    const base = new URL(process.env.FLOWW_API_BASE_URL ?? "");
    if (base.username || base.password || base.pathname !== "/" || base.search || base.hash ||
      !(base.protocol === "https:" || base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) ||
      target.origin !== base.origin || target.username || target.password || target.hash || !ownedPath.test(target.pathname)) return {};
    return { "x-vercel-protection-bypass": secret };
  } catch { return {}; }
}
