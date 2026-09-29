import "server-only";
import { walletBackendHealth } from "./health.ts";
import { teamMode, businessJwtReady } from "./team-session.ts";
import { teamWalletProxy } from "./team-server.ts";

export const walletAuthEnabled = () => process.env.FLOWW_WALLET_AUTH_ENABLED === "true";
export const sessionCookie = "floww_wallet_session";
const challengeCookie = "floww_wallet_challenge";
const safeHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function readCookie(request: Request, name: string) {
  const entries = (request.headers.get("cookie") ?? "").split(";").map(p => p.trim().split("="));
  const values = entries.filter(([k]) => k === name);
  return values.length === 1 && /^[a-f0-9]{64}$/.test(values[0][1] ?? "") ? values[0][1] : "";
}
function fail(code: string, status: number) { return Response.json({ reasonCode: code }, { status, headers: safeHeaders }); }
function cookie(name: string, value: string, seconds: number, secure: boolean) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${secure ? "; Secure" : ""}`;
}
export async function walletAuthProxy(request: Request, action: string) {
  if (action === "config" && request.method === "GET") return Response.json({ enabled: walletAuthEnabled(), mode: teamMode() ? "team-jwt" : "local-session", businessReady: !teamMode() || businessJwtReady(), chainIds: (process.env.FLOWW_WALLET_CHAIN_IDS ?? "").split(",").filter(id => /^[1-9][0-9]{0,15}$/.test(id)) }, { headers: safeHeaders });
  if (!walletAuthEnabled()) return fail("AUTH_CONTRACT_PENDING", 503);
  if (action === "health") return walletBackendHealth(request);
  if (teamMode()) return teamWalletProxy(request, action);
  const paths: Record<string, [string, string]> = { challenge: ["POST", "/api/v1/auth/wallet/nonce"], verify: ["POST", "/api/v1/auth/wallet/verify"], session: ["GET", "/api/v1/users/me"], logout: ["POST", "/api/v1/auth/signout"] };
  const spec = paths[action];
  if (!spec || request.method !== spec[0] || new URL(request.url).search) return fail("ROUTE_NOT_ALLOWED", 404);
  const originValue = request.headers.get("origin");
  if (request.method === "POST") {
    try {
      const origin = new URL(originValue ?? "");
      if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== originValue || origin.host !== (request.headers.get("host") ?? new URL(request.url).host)) return fail("ORIGIN_NOT_ALLOWED", 403);
    } catch { return fail("ORIGIN_NOT_ALLOWED", 403); }
  }
  const secure = process.env.NODE_ENV === "production";
  const session = readCookie(request, sessionCookie);
  if (action === "session" && !session) return Response.json(null, { headers: safeHeaders });
  let target: URL;
  try {
    target = new URL(process.env.FLOWW_API_BASE_URL ?? "");
    if (!["https:", "http:"].includes(target.protocol) || target.username || target.password || target.pathname !== "/" || target.search || target.hash) throw new Error();
    // Session credentials must never travel over cleartext to a remote backend.
    if (target.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) throw new Error();
    target.pathname = spec[1];
  } catch { return fail("BACKEND_NOT_CONFIGURED", 503); }
  let body: string | undefined;
  if (action === "challenge" || action === "verify") {
    try {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_INPUT", 400);
      const reader = request.body?.getReader();
      if (!reader) return fail("INVALID_INPUT", 400);
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.length; if (length > 2048) { await reader.cancel(); return fail("REQUEST_TOO_LARGE", 413); } chunks.push(chunk.value); }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (action === "challenge") {
        if (Object.keys(data).some(k => !["address", "chainId"].includes(k)) || typeof data.address !== "string" || !/^0x[0-9a-f]{40}$/i.test(data.address) || typeof data.chainId !== "string" || !/^[1-9][0-9]{0,15}$/.test(data.chainId)) return fail("INVALID_INPUT", 400);
      } else if (Object.keys(data).some(k => !["challengeId", "message", "signature"].includes(k)) || data.challengeId !== readCookie(request, challengeCookie) || !data.challengeId || typeof data.signature !== "string" || !/^0x[0-9a-f]{130}$/i.test(data.signature)) return fail("INVALID_PROOF", 400);
      body = JSON.stringify(action === "verify" ? { challengeId: data.challengeId, signature: data.signature } : data);
    } catch { return fail("INVALID_INPUT", 400); }
  }
  const responseHeaders = new Headers(safeHeaders);
  if (action === "verify" || action === "logout") responseHeaders.append("Set-Cookie", cookie(challengeCookie, "", 0, secure));
  if (action === "logout") responseHeaders.append("Set-Cookie", cookie(sessionCookie, "", 0, secure));
  try {
    const upstream = await fetch(target, { method: spec[0], headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(["session", "logout"].includes(action) && session ? { Authorization: `Bearer ${session}` } : {}) }, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (action === "logout") return Response.json({ revoked: upstream.ok }, { status: upstream.ok ? 200 : 502, headers: responseHeaders });
    if (action === "session" && upstream.status === 401) {
      responseHeaders.append("Set-Cookie", cookie(sessionCookie, "", 0, secure));
      return Response.json(null, { headers: responseHeaders });
    }
    if (!upstream.ok) return Response.json({ reasonCode: upstream.status === 401 ? "UNAUTHORIZED" : "AUTH_REQUEST_FAILED" }, { status: upstream.status === 401 ? 401 : 502, headers: responseHeaders });
    // Whitelist response fields; upstream tokens/errors/headers never pass through.
    const data = await upstream.json();
    if (action === "challenge") {
      if (typeof data.id !== "string" || !/^[a-f0-9]{64}$/.test(data.id) || typeof data.message !== "string" || data.message.length > 2000 || !validExpiry(data.expiresAt)) throw new Error();
      responseHeaders.append("Set-Cookie", cookie(challengeCookie, data.id, 300, secure));
      return Response.json({ id: data.id, message: data.message, expiresAt: data.expiresAt }, { headers: responseHeaders });
    }
    const s = action === "verify" ? data.session : data;
    if (s?.identity?.namespace !== "eip155" || typeof s.identity.address !== "string" || !/^0x[0-9a-f]{40}$/i.test(s.identity.address) || typeof s.chainId !== "string" || !/^[1-9][0-9]{0,15}$/.test(s.chainId) || !validExpiry(s.expiresAt)) throw new Error();
    if (action === "verify") {
      if (typeof data.sessionToken !== "string" || !/^[a-f0-9]{64}$/.test(data.sessionToken)) throw new Error();
      responseHeaders.append("Set-Cookie", cookie(sessionCookie, data.sessionToken, Math.min(3600, Math.floor((Date.parse(s.expiresAt) - Date.now()) / 1000)), secure));
    }
    return Response.json({ identity: { namespace: "eip155", address: s.identity.address }, chainId: s.chainId, expiresAt: s.expiresAt }, { headers: responseHeaders });
  } catch {
    return Response.json({ reasonCode: "AUTH_UPSTREAM_UNAVAILABLE" }, { status: 502, headers: responseHeaders });
  }
}
function validExpiry(value: unknown) { return typeof value === "string" && value.endsWith("Z") && Date.parse(value) > Date.now() && Date.parse(value) <= Date.now() + 3605000; }
