/** Completed execution API only. Decimal monetary amounts must remain strings. */
export type Conversation = { role: "user" | "assistant"; content: string }[];
export interface DraftResponse {
  httpContractVersion: "ai-draft-http.v1";
  status: "NEEDS_CLARIFICATION" | "READY_FOR_REVIEW" | "ERROR";
  draft: null | {
    schemaVersion: "ai-draft.v1";
    objective: string | null;
    itemScope: string | null;
    providerCriteria: string | null;
    maximumTotalCost: null | { amount: string; asset: string; includesAllUserPaidFees: boolean };
    deadline: string | null;
    fulfillmentCriterion: string | null;
  };
  issues: { code: string; field: string; question: string }[];
  evidence: Record<string, unknown> | null;
  error: { code: string } | null;
}
export interface TestMandate {
  goal: string;
  itemId: string;
  maxTotal: string;
  currency: "TEST_USDC";
  recipient: string;
  expiresAt: string;
}
export interface Execution {
  id: string;
  ownerId: string;
  status: "CREATED" | "RUNNING" | "REVIEWED" | "REJECTED" | "FAILED";
  mandate: TestMandate;
  createdAt: string;
  updatedAt: string;
}
export interface ExecutionEvent {
  seq: number;
  kind: string;
  createdAt: string;
  payload: Record<string, unknown>;
  [key: string]: unknown;
}
export interface EventPage { events: ExecutionEvent[]; nextCursor: number; hasMore: boolean }
export interface HistoryPage { executions: Execution[]; nextCursor: string | null; hasMore: boolean }
export interface EvidencePage {
  format: string;
  execution: Execution;
  events: EventPage;
  complete: boolean;
  pageComplete: boolean;
  nextCursor: number;
  paymentStatus: string;
  [key: string]: unknown;
}
export interface Readiness {
  kilnConfigured: boolean;
  merchantConfigured: boolean;
  merchantMode: string;
  paymentConfigured: boolean;
  processHealthIsIntegrationProof: boolean;
}
