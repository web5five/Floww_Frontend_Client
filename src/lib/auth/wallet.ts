export interface WalletProvider {
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}
export interface WalletOption { id: string; name: string; provider: WalletProvider }
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
