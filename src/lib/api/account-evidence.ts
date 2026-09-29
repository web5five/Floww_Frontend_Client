/** Read-only projection of Floww_Server PR #41 AccountView. No signing payloads. */
export interface AccountEvidence {
  taskId: string;
  state: string;
  accountAddress: string | null;
  amountBaseUnits: string;
  tokenAddress: string;
  paymentTxHash: string | null;
  paymentOperationState: string | null;
  paymentVerifiedAt: string | null;
  fulfillmentTxHash: string | null;
  fulfillmentOperationState: string | null;
  fulfillmentVerifiedAt: string | null;
  fulfillmentEvidenceMode: string | null;
}
const nullableHash = (v: unknown) => v === null || typeof v === "string" && /^0x[0-9a-f]{64}$/i.test(v);
const nullableDate = (v: unknown) => v === null || typeof v === "string" && v.endsWith("Z") && Number.isFinite(Date.parse(v));
export function parseAccountEvidence(value: unknown, taskId: string): AccountEvidence {
  if (!value || typeof value !== "object") throw new Error("INVALID_ACCOUNT_RESPONSE");
  const a = value as AccountEvidence;
  if (a.taskId !== taskId || typeof a.state !== "string" || !/^[A-Z_]{1,64}$/.test(a.state)
    || !(a.accountAddress === null || typeof a.accountAddress === "string" && /^0x[0-9a-f]{40}$/i.test(a.accountAddress))
    || typeof a.tokenAddress !== "string" || !/^0x[0-9a-f]{40}$/i.test(a.tokenAddress)
    || typeof a.amountBaseUnits !== "string" || !/^[1-9][0-9]{0,77}$/.test(a.amountBaseUnits)
    || BigInt(a.amountBaseUnits) >= (BigInt(1) << BigInt(256))
    || !nullableHash(a.paymentTxHash) || !nullableHash(a.fulfillmentTxHash)
    || !nullableDate(a.paymentVerifiedAt) || !nullableDate(a.fulfillmentVerifiedAt)
    || ![a.paymentOperationState, a.fulfillmentOperationState].every(v => v === null || typeof v === "string" && /^[A-Z_]{1,64}$/.test(v))
    || !(a.fulfillmentEvidenceMode === null || typeof a.fulfillmentEvidenceMode === "string" && a.fulfillmentEvidenceMode.length <= 100)) throw new Error("INVALID_ACCOUNT_RESPONSE");
  return a;
}
export function accountProgress(a: AccountEvidence, taskStatus: string) {
  const paid = a.paymentOperationState === "VERIFIED" && !!a.paymentTxHash && !!a.paymentVerifiedAt;
  const fulfilled = paid && a.fulfillmentOperationState === "VERIFIED" && !!a.fulfillmentTxHash && !!a.fulfillmentVerifiedAt;
  return { paid, fulfilled, completed: taskStatus === "COMPLETED" && a.state === "COMPLETED" && fulfilled };
}
