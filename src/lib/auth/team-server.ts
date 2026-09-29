import "server-only";
import { cookieValue, openSession, sealSession, sessionKey } from "./team-session.ts";

const safeHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (reasonCode: string, status: number) => Response.json({ reasonCode }, { status, headers: safeHeaders });
const cookie = (name: string, value: string, seconds: number) => `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
async function json(stream: ReadableStream<Uint8Array> | null, limit: number) {
  const reader = stream?.getReader(); if (!reader) throw new Error();
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const r = await reader.read(); if (r.done) break; length += r.value.length; if (length > limit) { await reader.cancel(); throw new Error(); } chunks.push(r.value); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
/** Adapter for team PR #24 / F018. Does not invent missing me/signout/business APIs. */
export async function teamWalletProxy(request: Request, action: string) {
  const get = request.method === "GET" && action === "session";
  const post = request.method === "POST" && ["challenge", "verify", "logout"].includes(action);
  if ((!get && !post) || new URL(request.url).search) return fail("ROUTE_NOT_ALLOWED", 404);
  if (post) {
    try {
      const value = request.headers.get("origin") ?? "", origin = new URL(value);
      if (!["https:", "http:"].includes(origin.protocol) || origin.origin !== value || origin.host !== (request.headers.get("host") ?? new URL(request.url).host)) return fail("ORIGIN_NOT_ALLOWED", 403);
    } catch { return fail("ORIGIN_NOT_ALLOWED", 403); }
  }
  if (action === "logout") {
    const headers = new Headers(safeHeaders);
    headers.append("Set-Cookie", cookie("floww_wallet_session", "", 0));
    headers.append("Set-Cookie", cookie("floww_wallet_challenge", "", 0));
    // F018 has no server revocation endpoint. Clear this BFF session only.
    return Response.json({ localLogout: true, serverRevocationAvailable: false }, { headers });
  }
  try { sessionKey(); } catch { return fail("AUTH_SESSION_NOT_CONFIGURED", 503); }
  if (get) {
    const s = openSession(request);
    return Response.json(s ? { identity: s.identity, chainId: s.chainId, expiresAt: s.expiresAt } : null, { headers: safeHeaders });
  }
  let base: URL;
  try {
    base = new URL(process.env.FLOWW_API_BASE_URL ?? "");
    if (base.username || base.password || base.pathname !== "/" || base.search || base.hash || !(base.protocol === "https:" || (base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)))) throw new Error();
    base.pathname = action === "challenge" ? "/api/v1/auth/wallet/nonce" : "/api/v1/auth/wallet/verify";
  } catch { return fail("BACKEND_NOT_CONFIGURED", 503); }
  let data, body;
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_INPUT", 400);
    data = await json(request.body, 8192);
    if (action === "challenge") {
      if (Object.keys(data).some(k => !["address", "chainId"].includes(k)) || !/^0x[0-9a-f]{40}$/i.test(data.address) || typeof data.chainId !== "string" || !/^[1-9][0-9]{0,15}$/.test(data.chainId) || !Number.isSafeInteger(Number(data.chainId))) return fail("INVALID_INPUT", 400);
      // Team contract uses an integer chainId. Monetary fields remain strings elsewhere.
      body = { address: data.address, chainId: Number(data.chainId) };
    } else {
      if (Object.keys(data).some(k => !["challengeId", "message", "signature"].includes(k)) || typeof data.message !== "string" || data.message.length > 2000 || !/^0x[0-9a-f]{130}$/i.test(data.signature) || !/^[a-f0-9]{48}$/.test(data.challengeId) || cookieValue(request, "floww_wallet_challenge") !== data.challengeId || !data.message.split("\n").includes(`Nonce: ${data.challengeId}`)) return fail("INVALID_PROOF", 400);
      body = { message: data.message, signature: data.signature };
    }
  } catch { return fail("INVALID_INPUT", 400); }
  const headers = new Headers(safeHeaders);
  if (action === "verify") headers.append("Set-Cookie", cookie("floww_wallet_challenge", "", 0));
  try {
    const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    const value = await json(response.body, 32768);
    if (!response.ok) {
      const allowed = ["CHAIN_NOT_SUPPORTED", "NONCE_INVALID", "NONCE_EXPIRED", "MESSAGE_MISMATCH", "SIGNATURE_INVALID", "USER_SUSPENDED", "TOO_MANY_REQUESTS"];
      return Response.json({ reasonCode: allowed.includes(value.reasonCode) ? value.reasonCode : "AUTH_REQUEST_FAILED" }, { status: response.status >= 400 && response.status <= 599 ? response.status : 502, headers });
    }
    if (action === "challenge") {
      if (!/^[a-f0-9]{48}$/.test(value.nonce) || typeof value.message !== "string" || value.message.length > 2000 || !expiry(value.expiresAt, 305000)) throw new Error();
      headers.append("Set-Cookie", cookie("floww_wallet_challenge", value.nonce, 300));
      return Response.json({ id: value.nonce, message: value.message, expiresAt: value.expiresAt, format: "team-jwt" }, { headers });
    }
    const address = data.message.split("\n")[1]?.toLowerCase();
    const chainId = data.message.split("\n").find((l: string) => l.startsWith("Chain ID: "))?.slice(10);
    if (typeof value.accessToken !== "string" || value.accessToken.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.accessToken) || value.tokenType !== "Bearer" || !Number.isInteger(value.expiresIn) || value.expiresIn < 1 || value.expiresIn > 1800 || value.user?.role !== "USER" || !Array.isArray(value.user.wallets) || !value.user.wallets.some((w: { address?: string }) => w.address?.toLowerCase() === address) || !/^0x[0-9a-f]{40}$/.test(address) || !/^[1-9][0-9]{0,15}$/.test(chainId)) throw new Error();
    // JWT was received over the trusted server channel; do not treat a browser-supplied JWT as authentication.
    const claims = JSON.parse(Buffer.from(value.accessToken.split(".")[1], "base64url").toString("utf8"));
    if (claims.sub !== value.user.userId || claims.role !== "USER" || !(claims.aud === "client" || (Array.isArray(claims.aud) && claims.aud.includes("client"))) || !Number.isInteger(claims.exp)) throw new Error();
    const expiresAt = new Date(Math.min(claims.exp * 1000, Date.now() + value.expiresIn * 1000)).toISOString();
    if (!expiry(expiresAt, 1801000)) throw new Error();
    const session = { identity: { namespace: "eip155" as const, address }, chainId, expiresAt };
    const sealed = sealSession({ ...session, accessToken: value.accessToken, userId: value.user.userId });
    if (sealed.length > 3800) throw new Error();
    headers.append("Set-Cookie", cookie("floww_wallet_session", sealed, Math.max(1, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))));
    return Response.json(session, { headers });
  } catch { return Response.json({ reasonCode: "AUTH_UPSTREAM_UNAVAILABLE" }, { status: 502, headers }); }
}
function expiry(value: unknown, maximum: number) { return typeof value === "string" && value.endsWith("Z") && Date.parse(value) > Date.now() && Date.parse(value) <= Date.now() + maximum; }
