/** Floww_Server TaskViews + PR #41 account execution contract. */
export interface TaskAsset { chainId: number; tokenAddress: string; tokenDecimals: number }
export interface TaskAttempt {
  attemptId: string; mandateId: string; mandateVersion: number; quoteId: string; merchantId: string;
  status: string; amountBaseUnits: string; recipientAddress: string;
  policy: { decision: "ALLOW" | "DENY"; reasonCode: string | null; message: { ko: string; en: string } | null };
  payment: { status: string; txHash: string | null };
  order?: { orderId: string; status: string; paymentStatus: string } | null;
}
export interface TaskView {
  taskId: string; status: string; statusReasonCode: string | null; goal: string;
  mandate: { mandateId: string; version: number; status: string; itemId: string; maxAmountBaseUnits: string; consumedBaseUnits: string; remainingBaseUnits: string; asset: TaskAsset; expiresAt: string; budgetScope: string };
  attempts: TaskAttempt[]; updatedAt: string; completedAt: string | null;
}
export interface TaskQuote {
  quoteId: string; merchantId: string; merchantName: string; itemName: string; totalAmountBaseUnits: string;
  asset: TaskAsset; recipientAddress: string; quotedPayToAddress: string; expiresAt: string; evidenceMode: string;
}
export interface TaskEvent { seq: number; kind: string; state: string; reasonCode: string | null; actor: string; createdAt: string }
export interface TaskEventPage { events: TaskEvent[]; nextCursor: number; hasMore: boolean }
export interface TaskInput { goal: string; itemId: string; maxAmountBaseUnits: string; expiresAt: string }
export const isBaseUnits = (value: unknown): value is string => typeof value === "string" && /^(0|[1-9][0-9]{0,77})$/.test(value);
export function toBaseUnits(value: string): string {
  if (!/^(0|[1-9][0-9]{0,70})(\.[0-9]{1,6})?$/.test(value)) throw new Error("금액은 양수이며 소수점 6자리까지만 입력하세요.");
  const [whole, fraction = ""] = value.split(".");
  const result = (BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, "0"))).toString();
  if (result === "0") throw new Error("예산은 0보다 커야 합니다.");
  return result;
}
