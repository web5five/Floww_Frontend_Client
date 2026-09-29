import "server-only";
import { walletAuthEnabled, readCookie, sessionCookie } from "../auth/server.ts";
import { teamMode, businessJwtReady, openSession } from "../auth/team-session.ts";

const uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const detail = new RegExp(`^api/executions/${uuid}(?:/(events|evidence\\.json))?$`);
const run = new RegExp(`^api/executions/${uuid}/run$`);
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function error(reasonCode: string, status: number) { return Response.json({ reasonCode }, { status, headers }); }
async function boundedText(stream: ReadableStream<Uint8Array> | null, max: number) {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new Error("LIMIT"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function redact(value: unknown, token: string): unknown {
  if (typeof value === "string") return value.split(token).join("[REDACTED]").replace(/Bearer\s+\S+/gi, "[REDACTED]");
  if (Array.isArray(value)) return value.map(item => redact(item, token));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !/authorization|token|secret|private.?key|seed|password/i.test(key) || /^(prompt_tokens|completion_tokens|total_tokens)$/.test(key)).map(([key, item]) => [String(redact(key, token)), redact(item, token)]));
  return value;
}
export async function proxy(request: Request, path: string[]) {
  const route = path.join("/");
  const getAllowed = ["actuator/health", "api/integrations/readiness", "api/executions", "api/executions/history"].includes(route) || detail.test(route);
  const postAllowed = ["api/ai/drafts", "api/executions"].includes(route) || run.test(route);
  if (!(request.method === "GET" ? getAllowed : request.method === "POST" && postAllowed)) return error("ROUTE_NOT_ALLOWED", 404);
  const url = new URL(request.url);
  const allowedQuery = route.endsWith("/history") ? ["limit", "before"] : /\/(events|evidence\.json)$/.test(route) ? ["after", "limit"] : route === "api/executions" && request.method === "GET" ? ["limit"] : [];
  for (const [key, value] of url.searchParams) {
    if (!allowedQuery.includes(key) || url.searchParams.getAll(key).length !== 1) return error("INVALID_INPUT", 400);
    if (key === "limit" && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(value)) return error("INVALID_LIMIT", 400);
    if (key === "after" && (!/^\d{1,16}$/.test(value) || !Number.isSafeInteger(Number(value)))) return error("INVALID_CURSOR", 400);
    if (key === "before" && !new RegExp(`^${uuid}$`).test(value)) return error("INVALID_CURSOR", 400);
  }
  // No browser credentials accepted. Mutations must originate in this application.
  if (request.method === "POST") {
    try {
      const origin = new URL(request.headers.get("origin") ?? "");
      // Next may normalize request.url to localhost internally. Compare the actual
      // incoming Host, never a caller-provided X-Forwarded-Host.
      if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== request.headers.get("origin") || origin.host !== (request.headers.get("host") ?? url.host)) return error("ORIGIN_NOT_ALLOWED", 403);
    } catch { return error("ORIGIN_NOT_ALLOWED", 403); }
  }
  const base = process.env.FLOWW_API_BASE_URL;
  if (walletAuthEnabled() && teamMode() && !businessJwtReady()) return error("JWT_BUSINESS_API_PENDING", 503);
  const token = walletAuthEnabled() ? (teamMode() ? openSession(request)?.accessToken : readCookie(request, sessionCookie)) : process.env.FLOWW_SERVER_DEV_TOKEN;
  if (walletAuthEnabled() && !token) return error("UNAUTHORIZED", 401);
  if (!base || !token || token.length < 16) return error("BACKEND_NOT_CONFIGURED", 503);
  let target: URL;
  try {
    target = new URL(base);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || target.search || target.hash || target.pathname !== "/") throw new Error();
    if (walletAuthEnabled() && target.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) throw new Error();
    target.pathname = `/${route}`;
    target.search = url.search;
  } catch { return error("BACKEND_NOT_CONFIGURED", 503); }
  const outboundHeaders: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  let body: string | undefined;
  if (request.method === "POST") {
    try {
      body = await boundedText(request.body, 128 * 1024);
      if (run.test(route)) {
        if (body) return error("INVALID_INPUT", 400);
        body = undefined;
      } else {
        if (!request.headers.get("content-type")?.startsWith("application/json")) return error("UNSUPPORTED_MEDIA_TYPE", 415);
        const data = JSON.parse(body);
        if (route === "api/ai/drafts") {
          const c = data.conversation;
          if (Object.keys(data).some(k => k !== "conversation") || !Array.isArray(c) || c.length < 1 || c.length > 12 || c.at(-1)?.role !== "user" || c.some(m => !m || Object.keys(m).some(k => !["role", "content"].includes(k)) || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 4000) || c.reduce((sum, m) => sum + m.content.length, 0) > 16000) return error("INVALID_CONVERSATION", 400);
        } else {
          const m = data.mandate;
          if (data.confirmed !== true || Object.keys(data).some(k => !["confirmed", "mandate"].includes(k)) || !m || Object.keys(m).some(k => !["goal", "itemId", "maxTotal", "currency", "recipient", "expiresAt"].includes(k)) || typeof m.goal !== "string" || !m.goal.trim() || m.goal.length > 500 || /[\x00-\x1f\x7f]/.test(m.goal) || typeof m.maxTotal !== "string" || !/^\d{1,12}(\.\d{1,8})?$/.test(m.maxTotal) || !/[1-9]/.test(m.maxTotal) || m.currency !== "TEST_USDC" || typeof m.itemId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(m.itemId) || typeof m.recipient !== "string" || !/^[A-Za-z0-9._:-]{3,128}$/.test(m.recipient) || typeof m.expiresAt !== "string" || !m.expiresAt.endsWith("Z") || !(Date.parse(m.expiresAt) > Date.now())) return error("INVALID_INPUT", 400);
          const key = request.headers.get("idempotency-key");
          if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return error("INVALID_IDEMPOTENCY_KEY", 400);
          outboundHeaders["Idempotency-Key"] = key;
        }
        outboundHeaders["Content-Type"] = "application/json; charset=utf-8";
      }
    } catch (e) { return error(e instanceof Error && e.message === "LIMIT" ? "REQUEST_TOO_LARGE" : "INVALID_INPUT", e instanceof Error && e.message === "LIMIT" ? 413 : 400); }
  }
  try {
    const upstream = await fetch(target, { method: request.method, headers: outboundHeaders, body, cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]) });
    const data = redact(JSON.parse(await boundedText(upstream.body, 4 * 1024 * 1024)), token);
    const responseHeaders: Record<string, string> = { ...headers };
    if (route.endsWith("/evidence.json") && upstream.ok) responseHeaders["Content-Disposition"] = `attachment; filename="floww-evidence-${path[2]}.json"`;
    return Response.json(data, { status: upstream.status, headers: responseHeaders });
  } catch { return error("UPSTREAM_UNAVAILABLE", 502); }
}
