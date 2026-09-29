import "server-only";
import { previewBypassHeader } from "../api/preview-bypass.ts";
/** Public health probe only: no cookies, JWTs or development tokens forwarded. */
export async function walletBackendHealth(request: Request) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const fail = (reasonCode: string, status: number) => Response.json({ reasonCode }, { status, headers });
  if (request.method !== "GET" || new URL(request.url).search) return fail("ROUTE_NOT_ALLOWED", 404);
  let target: URL;
  try {
    target = new URL(process.env.FLOWW_API_BASE_URL ?? "");
    if (target.username || target.password || target.pathname !== "/" || target.search || target.hash || !(target.protocol === "https:" || (target.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)))) throw new Error();
    target.pathname = "/actuator/health";
  } catch { return fail("BACKEND_NOT_CONFIGURED", 503); }
  try {
    const response = await fetch(target, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000), headers: { Accept: "application/json", ...previewBypassHeader(target) } });
    if (!response.ok) { await response.body?.cancel(); return fail("AUTH_UPSTREAM_UNAVAILABLE", 503); }
    const reader = response.body?.getReader(); if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.length;
      if (size > 16384) { await reader.cancel(); throw new Error(); }
      chunks.push(result.value);
    }
    if (JSON.parse(Buffer.concat(chunks).toString("utf8")).status !== "UP") return fail("AUTH_UPSTREAM_UNAVAILABLE", 503);
    return Response.json({ ready: true }, { headers });
  } catch { return fail("AUTH_UPSTREAM_UNAVAILABLE", 503); }
}
