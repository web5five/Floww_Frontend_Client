import type { WalletAuthAdapter } from "./types";
export const authConnectionNotice = "현재 로그인에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
async function call<T>(action: string, method: "GET" | "POST", input?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/wallet-auth/${action}`, { method, credentials: "same-origin", cache: "no-store", signal, headers: input ? { "Content-Type": "application/json" } : {}, body: input ? JSON.stringify(input) : undefined });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const allowed = ["BACKEND_NOT_CONFIGURED", "AUTH_SESSION_NOT_CONFIGURED", "AUTH_UPSTREAM_UNAVAILABLE", "NONCE_EXPIRED", "TOO_MANY_REQUESTS"];
    throw new Error(allowed.includes(body?.reasonCode) ? body.reasonCode : "AUTH_REQUEST_FAILED");
  }
  return response.json();
}
export const checkWalletBackend = () => call<{ ready: boolean }>("health", "GET", undefined, AbortSignal.timeout(20000));
/** Server adapter; feature flag remains off until matching backend is configured. */
export const walletAuthAdapter: WalletAuthAdapter = {
  getSession: signal => call("session", "GET", undefined, signal),
  getChallenge: (input, signal) => call("challenge", "POST", input, signal),
  verify: (input, signal) => call("verify", "POST", input, signal),
  logout: async signal => { await call("logout", "POST", undefined, signal); },
};
