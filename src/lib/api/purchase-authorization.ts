/** Canonical Floww_Server PR #41 contract. task-account.ts verifies server
 * preparations against the pinned artifact and shared ReviewSnapshotV1 vector.
 */
export interface MandateApprovalMessage {
  owner: string;
  taskId: string; // bytes32, mapped by the backend using Ethereum keccak256.
  reviewSnapshotDigest: string; // bytes32, exact shared ReviewSnapshotV1 encoding.
  token: string;
  recipient: string;
  executor: string;
  fulfillmentReporter: string;
  maxSpend: string; // uint256 base units: selected quote cap, not Task-wide budget.
  expiresAt: string; // uint64 unix seconds, no later than quote expiry.
  nonce: string; // uint256 authorizationNonce read from deployed account.
}
export interface MandateApprovalDomain {
  name: "FlowwTaskAccount";
  version: "1";
  chainId: 11155111;
  verifyingContract: string;
}
// paymentId belongs to the persisted execution intent, never MandateApproval.
// Constructor inputs, ABI and exact ReviewSnapshotV1 encoding are backend/chain handoffs.
