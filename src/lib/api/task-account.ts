import { AbiCoder, Interface, TypedDataEncoder, id, keccak256, verifyTypedData } from "ethers";
import artifact from "./task-account-artifact.json";
import { parseAccountEvidence, type AccountEvidence } from "./account-evidence";
import { taskRequest } from "./task-client";
import type { TaskView, TaskAttempt } from "./task-types";

/** Floww_Server PR #41; pinned artifact commit is recorded alongside the bytecode. */
export interface TaskAccount extends AccountEvidence {
  attemptId: string; ownerAddress: string; deployTxHash: string | null;
  chainTaskId: string; reviewSnapshotDigest: string; recipientAddress: string;
  executorAddress: string; fulfillmentReporter: string; quoteExpiresAt: string; expiresAt: string;
  deploymentData: string | null; approvalDigest: string | null;
  approvalTxHash: string | null; approvalOperationState: string | null;
}
export interface Funding {
  accountAddress: string; tokenAddress: string; amountBaseUnits: string;
  tokenApproveData: string; accountFundData: string; accountTokenBalanceBaseUnits: string; mandateApproved: boolean;
}
export interface Approval {
  typedData: { domain: { name: string; version: string; chainId: number; verifyingContract: string }; primaryType: string; types: Record<string, { name: string; type: string }[]>; message: Record<string, string> };
  digest: string; nonce: string; expiresAt: string;
}
export const accountAbi = new Interface(artifact.abi);
const erc20 = new Interface(["function approve(address spender,uint256 amount)"]);
const equal = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
const address = (v: unknown) => typeof v === "string" && /^0x[0-9a-f]{40}$/i.test(v) && !/^0x0{40}$/i.test(v);
const uint = (v: unknown) => typeof v === "string" && /^(0|[1-9][0-9]{0,77})$/.test(v) && BigInt(v) < (BigInt(1) << BigInt(256));
const seconds = (v: string) => { const n = Date.parse(v); if (!v.endsWith("Z") || !Number.isFinite(n)) throw new Error("INVALID_EXPIRY"); return String(Math.floor(n / 1000)); };
const check = (ok: unknown, reason: string) => { if (!ok) throw new Error(reason); };
export function reviewDigest(t: TaskView, a: TaskAttempt, quoteExpiresAt: string) {
  return keccak256(AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes16", "uint256", "bytes16", "string", "string", "uint256", "address", "address", "uint64"],
    [id(`floww:task:${t.taskId.toLowerCase()}`), `0x${t.mandate.mandateId.replaceAll("-", "")}`, t.mandate.version,
      `0x${a.attemptId.replaceAll("-", "")}`, a.merchantId, a.quoteId, a.amountBaseUnits, a.recipientAddress, t.mandate.asset.tokenAddress, seconds(quoteExpiresAt)]));
}
export function validateAccount(value: unknown, task: TaskView, owner: string): TaskAccount {
  const a = parseAccountEvidence(value, task.taskId) as TaskAccount;
  const attempt = task.attempts.find(x => x.attemptId === a.attemptId);
  check(attempt && attempt.policy.decision === "ALLOW" && attempt.mandateId === task.mandate.mandateId && attempt.mandateVersion === task.mandate.version, "ACCOUNT_ATTEMPT_MISMATCH");
  check(equal(a.ownerAddress, owner) && address(a.ownerAddress) && [a.executorAddress, a.fulfillmentReporter, a.recipientAddress].every(address), "ACCOUNT_OWNER_OR_ACTOR_MISMATCH");
  check(task.mandate.asset.chainId === 11155111 && task.mandate.asset.tokenDecimals === 6 && equal(a.tokenAddress, task.mandate.asset.tokenAddress), "ACCOUNT_TOKEN_OR_CHAIN_MISMATCH");
  check(equal(a.recipientAddress, attempt!.recipientAddress) && a.amountBaseUnits === attempt!.amountBaseUnits && BigInt(a.amountBaseUnits) <= BigInt(task.mandate.maxAmountBaseUnits), "ACCOUNT_RECIPIENT_OR_AMOUNT_MISMATCH");
  check(equal(a.chainTaskId, id(`floww:task:${task.taskId.toLowerCase()}`)) && equal(a.reviewSnapshotDigest, reviewDigest(task, attempt!, a.quoteExpiresAt)), "REVIEW_SNAPSHOT_MISMATCH");
  check(seconds(a.expiresAt) === String(Math.min(Number(seconds(a.quoteExpiresAt)), Number(seconds(task.mandate.expiresAt)))), "ACCOUNT_EXPIRY_MISMATCH");
  check(["PREPARED", "BOUND", "SIGNED", "APPROVAL_UNKNOWN", "APPROVED", "PAYMENT_UNKNOWN", "PAID", "FULFILLMENT_UNKNOWN", "COMPLETED"].includes(a.state), "UNKNOWN_ACCOUNT_STATE");
  if (a.state !== "PREPARED") check(address(a.accountAddress), "ACCOUNT_ADDRESS_MISSING");
  return a;
}
export function assertLive(t: TaskView, a: TaskAccount) {
  check(["AWAITING_APPROVAL", "ACTIVE", "EXECUTING"].includes(t.status) && Date.parse(a.expiresAt) > Date.now(), "TASK_STOPPED_OR_EXPIRED");
}
export function checkedDeployment(a: TaskAccount) {
  const args = [a.ownerAddress, [a.chainTaskId, a.reviewSnapshotDigest, a.tokenAddress, a.recipientAddress, a.executorAddress, a.fulfillmentReporter, a.amountBaseUnits, seconds(a.expiresAt)]];
  const bytecode = artifact.bytecode.startsWith("0x") ? artifact.bytecode : `0x${artifact.bytecode}`;
  const expected = bytecode + accountAbi.encodeDeploy(args).slice(2);
  check(a.state === "PREPARED" && equal(expected, a.deploymentData), "UNREVIEWED_DEPLOYMENT_DATA");
  return expected;
}
const fields = ["owner:address", "taskId:bytes32", "reviewSnapshotDigest:bytes32", "token:address", "recipient:address", "executor:address", "fulfillmentReporter:address", "maxSpend:uint256", "expiresAt:uint64", "nonce:uint256"].map(x => { const [name,type] = x.split(":"); return {name,type}; });
export function checkedApproval(a: TaskAccount, r: Approval) {
  const d = r.typedData, m = d?.message;
  const domainFields = ["name:string", "version:string", "chainId:uint256", "verifyingContract:address"].map(x => { const [name,type] = x.split(":"); return {name,type}; });
  const sameFields = (x: unknown, y: {name:string;type:string}[]) => Array.isArray(x) && x.length === y.length && x.every((v,i) => v.name === y[i].name && v.type === y[i].type && Object.keys(v).length === 2);
  check(d?.primaryType === "MandateApproval" && Object.keys(d.types).length === 2 && sameFields(d.types.MandateApproval, fields) && sameFields(d.types.EIP712Domain, domainFields), "TYPED_DATA_SCHEMA_MISMATCH");
  check(d.domain.name === "FlowwTaskAccount" && d.domain.version === "1" && d.domain.chainId === 11155111 && equal(d.domain.verifyingContract, a.accountAddress) && Object.keys(d.domain).length === 4, "TYPED_DATA_DOMAIN_MISMATCH");
  const expected = { owner: a.ownerAddress, taskId: a.chainTaskId, reviewSnapshotDigest: a.reviewSnapshotDigest, token: a.tokenAddress, recipient: a.recipientAddress, executor: a.executorAddress, fulfillmentReporter: a.fulfillmentReporter, maxSpend: a.amountBaseUnits, expiresAt: seconds(a.expiresAt), nonce: r.nonce };
  check(uint(r.nonce) && m && Object.keys(m).length === fields.length && Object.entries(expected).every(([k,v]) => equal(m[k],v)) && r.expiresAt === a.expiresAt, "TYPED_DATA_MESSAGE_MISMATCH");
  check(equal(TypedDataEncoder.hash(d.domain, { MandateApproval: fields }, m), r.digest), "TYPED_DATA_DIGEST_MISMATCH");
  return d;
}
export function checkSignature(a: TaskAccount, r: Approval, signature: unknown): string {
  const d = checkedApproval(a,r);
  check(typeof signature === "string" && /^0x[0-9a-f]{130}$/i.test(signature), "INVALID_SIGNATURE");
  check(equal(verifyTypedData(d.domain, { MandateApproval: fields }, d.message, signature as string), a.ownerAddress), "SIGNER_MISMATCH");
  return signature as string;
}
export function checkedFunding(a: TaskAccount, f: Funding) {
  check(equal(a.accountAddress,f.accountAddress) && equal(a.tokenAddress,f.tokenAddress) && a.amountBaseUnits === f.amountBaseUnits && uint(f.accountTokenBalanceBaseUnits) && f.mandateApproved === true, "FUNDING_MISMATCH");
  check(equal(f.tokenApproveData,erc20.encodeFunctionData("approve",[a.accountAddress,a.amountBaseUnits])) && equal(f.accountFundData,accountAbi.encodeFunctionData("fund",[a.amountBaseUnits])), "UNREVIEWED_FUNDING_DATA");
  return f;
}
const route = (taskId: string) => { check(/^[0-9a-f-]{36}$/i.test(taskId), "INVALID_TASK_ID"); return `/${taskId}/account`; };
export const accountApi = {
  get: (id: string) => taskRequest<unknown>(route(id)),
  funding: (id: string) => taskRequest<Funding>(`${route(id)}/funding`),
  action: (id: string, action: "prepare"|"bind"|"approval-request"|"signature"|"approve"|"reconcile"|"payment"|"fulfillment", body?: object) => taskRequest<unknown>(`${route(id)}/${action}`, { method:"POST", ...(body ? { headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) } : {}) }),
  order: (id: string, attemptId: string, key: string) => taskRequest<unknown>(`/${id}/orders`, { method:"POST", headers:{"Content-Type":"application/json", "Idempotency-Key":key}, body:JSON.stringify({attemptId}) }),
};
