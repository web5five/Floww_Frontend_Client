/** Proposed Floww_Server contracts; endpoint and response schemas are not confirmed. */
export interface PurchaseRequest {
  intent: string;
  requirements: { brand: string; category: string; color: string; size_eu: number };
  budget: { currency: "USDC"; maximum: number };
  deadline: string;
  /** Proposed extension pending agreement with the backend. */
  allowed_merchants: string[];
}
export type DemoScenario = "normal" | "over-budget" | "unapproved-merchant";
export type PurchaseStatus = "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED" | "BLOCKED" | "STOPPED";
export interface ProductCandidate {
  title: string;
  brand: string;
  category: string;
  color: string;
  size_eu: number;
  merchant: string;
  price: number;
  estimated_fee: number;
}
export type CheckKey = "requirements" | "budget" | "merchant" | "deadline";
export interface PolicyCheck { key: CheckKey; label: string; passed: boolean; reason: string }
export interface PurchaseJudgment {
  model: "qwen3-32b";
  source: "mock";
  checks: PolicyCheck[];
  allowed: boolean;
  reasons: string[];
  uncertainties: string[];
}
export interface ApprovalAudit {
  approved_at: string;
  merchant: string;
  total: number;
  currency: "USDC";
  actor: "현재 사용자 (데모 · 미인증)";
}
export interface DemoTask {
  task_id: string;
  source: "mock";
  scenario: DemoScenario;
  request: PurchaseRequest;
  candidate: ProductCandidate;
  judgment: PurchaseJudgment;
  status: PurchaseStatus;
  approval?: ApprovalAudit;
  rejection?: { reason: string; rejected_at: string };
  stop?: { reason: string; stopped_at: string; execution_prohibited: true };
}
export type PurchaseEventType = "MANDATE_CREATED" | "AI_JUDGMENT" | "POLICY_CHECK" | "USER_APPROVED" | "USER_REJECTED" | "CANCELLED" | "BUDGET_BLOCKED" | "MERCHANT_BLOCKED" | "REQUIREMENTS_BLOCKED" | "DEADLINE_BLOCKED" | "AGENT_STOPPED";
export interface PurchaseEvent {
  id: string;
  task_id: string;
  type: PurchaseEventType;
  title: string;
  detail: string;
  status: "DEMO" | "PASS" | PurchaseStatus;
  created_at: string;
  reason?: string;
  approval?: ApprovalAudit;
}
export interface DemoState { task: DemoTask | null; events: PurchaseEvent[]; run: number }
export interface DashboardData { source: "mock"; candidate: ProductCandidate; connection: "not-connected" }
export interface Evidence {
  task_id: string;
  connection: "not-connected";
  payment_status: "not-executed";
  authorization_status: PurchaseStatus | "NOT_CREATED";
  execution_allowed: false;
  // Transaction hashes are deliberately absent until a real receipt contract exists.
}
export interface ApiSuccess<T> { data: T }
export interface ApiFailure { error: { code: string; message: string } }
export interface FlowwTaskClient {
  createTask(request: PurchaseRequest): Promise<DemoTask>;
  confirmMandate(taskId: string): Promise<DemoTask>;
  execute(taskId: string): Promise<DemoTask>;
  getTask(taskId: string): Promise<DemoTask>;
  getEvents(taskId: string): Promise<PurchaseEvent[]>;
  cancel(taskId: string): Promise<DemoTask>;
  getEvidence(taskId: string): Promise<Evidence>;
}
