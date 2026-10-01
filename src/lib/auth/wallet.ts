export interface WalletProvider {
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}
export interface WalletOption { id: string; name: string; provider: WalletProvider }
export type WalletRequestPhase = "account" | "chain" | "operation";
export type WalletFailureCategory = "rejected" | "unauthorized" | "unsupported" | "disconnected" | "invalid_request" | "provider_internal" | "provider_server" | "insufficient_gas_funds" | "unclassified";
/** Keep wallet failure diagnostics without retaining provider messages or transaction payloads. */
export class WalletRequestFailure extends Error {
  readonly phase: WalletRequestPhase;
  readonly code: number | null;
  readonly category: WalletFailureCategory;
  constructor(phase: WalletRequestPhase, cause: unknown) {
    super("WALLET_PROVIDER_REQUEST_FAILED");
    this.name = "WalletRequestFailure";
    this.phase = phase;
    const raw = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
    this.code = typeof raw === "number" && Number.isSafeInteger(raw) ? raw : null;
    const message = cause && typeof cause === "object" && "message" in cause && typeof cause.message === "string" ? cause.message : "";
    this.category = this.code === 4001 ? "rejected" : this.code === 4100 ? "unauthorized"
      : this.code === 4200 ? "unsupported" : this.code === 4900 || this.code === 4901 ? "disconnected"
      : this.code === -32600 || this.code === -32601 || this.code === -32602 ? "invalid_request"
      : this.code === -32603 ? "provider_internal"
      : this.code === -32000 && /\binsufficient funds for (?:gas|intrinsic transaction cost)\b/i.test(message) ? "insufficient_gas_funds"
      : this.code !== null && this.code >= -32099 && this.code <= -32000 ? "provider_server" : "unclassified";
  }
}
export function isProvider(value: unknown): value is WalletProvider {
  const p = value as Partial<WalletProvider> | null;
  return !!p && typeof p.request === "function" && typeof p.on === "function" && typeof p.removeListener === "function";
}
export function account(value: unknown): string | null {
  return Array.isArray(value) && typeof value[0] === "string" && /^0x[0-9a-f]{40}$/i.test(value[0]) ? value[0] : null;
}
export function chain(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-f]+$/i.test(value) && value.length <= 66 ? value : null;
}
export function walletError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 4001) return "지갑 연결을 거절했습니다. 원할 때 다시 연결할 수 있습니다.";
  if (code === -32002) return "지갑에 대기 중인 요청이 있습니다. 지갑 화면을 확인해 주세요.";
  if (code === 4900 || code === 4901) return "지갑 또는 네트워크 연결이 끊겼습니다.";
  return "지갑 연결을 확인하지 못했습니다. 지갑 상태를 확인하고 다시 시도해 주세요.";
}
