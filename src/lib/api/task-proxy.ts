import "server-only";
import { walletAuthEnabled } from "../auth/server.ts";
import { openSession, teamMode, businessJwtReady } from "../auth/team-session.ts";

const uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const idPath = new RegExp(`^${uuid}$`), eventPath = new RegExp(`^${uuid}/events$`);
const mutationPath = new RegExp(`^${uuid}/(quotes|ai-proposal|mandate/reject|cancel)$`);
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (reasonCode: string, status: number) => Response.json({ reasonCode }, { status, headers });
async function limited(stream: ReadableStream<Uint8Array> | null, max: number) {
  if (!stream) return "";
  const reader = stream.getReader(), chunks: Uint8Array[] = []; let length = 0;
  while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > max) { await reader.cancel(); throw new Error("SIZE_LIMIT"); } chunks.push(part.value); }
  return Buffer.concat(chunks).toString("utf8");
}
function sanitize(value: unknown, token: string): unknown {
  if (typeof value === "string") return value.split(token).join("[REDACTED]").replace(/Bearer\s+\S+/gi, "[REDACTED]");
  if (Array.isArray(value)) return value.map(v => sanitize(v, token));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([k]) => !/^(authorization|accessToken|refreshToken|token|secret|password|privateKey|seedPhrase|signature)$/i.test(k)).map(([k, v]) => [k.split(token).join("[REDACTED]"), sanitize(v, token)]));
  return value;
}
export async function taskProxy(request: Request, parts: string[]) {
  const path = parts.join("/"), url = new URL(request.url), post = request.method === "POST";
  if (!(request.method === "GET" && (!path || idPath.test(path) || eventPath.test(path))) && !(post && (!path || mutationPath.test(path)))) return fail("ROUTE_NOT_ALLOWED", 404);
  const allowed = eventPath.test(path) ? ["after", "limit"] : !path && !post ? ["limit"] : [];
  for (const [key, value] of url.searchParams) {
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1 || !/^\d{1,15}$/.test(value) || !Number.isSafeInteger(Number(value)) || (key === "limit" && (Number(value) < 1 || Number(value) > (path ? 100 : 50)))) return fail("INVALID_INPUT", 400);
  }
  if (post && request.headers.get("origin") !== url.origin && request.headers.get("origin") !== `${url.protocol}//${request.headers.get("host")}`) return fail("ORIGIN_NOT_ALLOWED", 403);
  if (!walletAuthEnabled() || !teamMode() || !businessJwtReady()) return fail("TASK_CONNECTION_NOT_CONFIGURED", 503);
  const session = openSession(request);
  if (!session) return fail("UNAUTHORIZED", 401);
  let base: URL;
  try {
    base = new URL(process.env.FLOWW_API_BASE_URL ?? "");
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/" || !(base.protocol === "https:" || (base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)))) throw new Error();
    base.pathname = `/api/v1/tasks${path ? `/${path}` : ""}`; base.search = url.search;
  } catch { return fail("BACKEND_NOT_CONFIGURED", 503); }
  const outbound: Record<string, string> = { Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" };
  let body: string | undefined;
  if (post) {
    try {
      const raw = await limited(request.body, 8192);
      if (path) { if (raw) return fail("INVALID_INPUT", 400); }
      else {
        if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_INPUT", 400);
        const data = JSON.parse(raw), future = Date.parse(data.expiresAt) - Date.now();
        if (Object.keys(data).some(k => !["goal", "itemId", "maxAmountBaseUnits", "expiresAt"].includes(k)) || typeof data.goal !== "string" || !data.goal.trim() || data.goal.length > 500 || !["acetaminophen-500mg-10", "ibuprofen-200mg-20"].includes(data.itemId) || typeof data.maxAmountBaseUnits !== "string" || !/^[1-9][0-9]{0,77}$/.test(data.maxAmountBaseUnits) || typeof data.expiresAt !== "string" || !data.expiresAt.endsWith("Z") || !(future > 0 && future <= 30 * 86400000)) return fail("INVALID_INPUT", 400);
        if (BigInt(data.maxAmountBaseUnits) > (BigInt(1) << BigInt(256)) - BigInt(1)) return fail("INVALID_INPUT", 400);
        const key = request.headers.get("idempotency-key");
        if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return fail("INVALID_IDEMPOTENCY_KEY", 400);
        outbound["Idempotency-Key"] = key; outbound["Content-Type"] = "application/json"; body = JSON.stringify(data);
      }
    } catch { return fail("INVALID_INPUT", 400); }
  }
  try {
    const response = await fetch(base, { method: request.method, body, headers: outbound, redirect: "manual", cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(path.endsWith("ai-proposal") ? 120000 : 20000)]) });
    if (response.status >= 300 && response.status < 400) return fail("BACKEND_ACCESS_PROTECTED", 502);
    const data = sanitize(JSON.parse(await limited(response.body, 4 * 1024 * 1024)), session.accessToken);
    return Response.json(data, { status: response.status, headers });
  } catch { return fail("UPSTREAM_UNAVAILABLE", 502); }
}
