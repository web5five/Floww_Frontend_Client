import { defaultRequest, scenarioCandidate } from "./api/mock";
import type { DemoScenario, DemoState, PolicyCheck, ProductCandidate, PurchaseEvent, PurchaseJudgment, PurchaseRequest, PurchaseStatus, DemoTask, ApprovalAudit } from "./api/types";

export const statusLabels: Record<PurchaseStatus, string> = {
  AWAITING_APPROVAL: "사용자 승인 대기",
  APPROVED: "APPROVED · 승인됨",
  REJECTED: "REJECTED · 거절됨",
  CANCELLED: "전체 중단됨",
  BLOCKED: "BLOCKED",
  STOPPED: "STOPPED",
};
export const toUnits = (value: number) => Math.round(value * 100);
export const totalPrice = (candidate: ProductCandidate) => (toUnits(candidate.price) + toUnits(candidate.estimated_fee)) / 100;
export const usdc = (value: number) => `${value.toFixed(2)} USDC`;
export const displayDate = (iso: string) => new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function validateRequest(request: PurchaseRequest, now: number): string | null {
  if (!request.intent.trim() || Object.values(request.requirements).some(v => typeof v === "string" && !v.trim())) return "상품 목적과 모든 상품 조건을 입력해 주세요.";
  if (request.intent.length > 160 || [request.requirements.brand, request.requirements.category, request.requirements.color].some(v => v.length > 80)) return "상품 조건은 각 80자, 구매 목적은 160자 이내로 입력해 주세요.";
  if (!Number.isFinite(request.requirements.size_eu) || request.requirements.size_eu < 1 || request.requirements.size_eu > 60) return "EU 사이즈는 1~60 사이로 입력해 주세요.";
  if (request.budget.currency !== "USDC" || !Number.isFinite(request.budget.maximum) || request.budget.maximum <= 0 || request.budget.maximum > 1000000 || Math.abs(request.budget.maximum * 100 - Math.round(request.budget.maximum * 100)) > 0.00001) return "예산은 0보다 큰 USDC 금액으로 소수점 둘째 자리까지 입력해 주세요.";
  if (!Number.isFinite(Date.parse(request.deadline)) || Date.parse(request.deadline) <= now) return "구매 기한은 현재 시각 이후로 설정해 주세요.";
  if (!request.allowed_merchants.length || request.allowed_merchants.some(v => !v.trim() || v.length > 80)) return "허용 판매처를 하나 이상 입력해 주세요. 판매처 이름은 80자 이내입니다.";
  return null;
}
export function judgePurchase(request: PurchaseRequest, candidate: ProductCandidate, now: number): PurchaseJudgment {
  const matches = candidate.brand.toLowerCase() === request.requirements.brand.trim().toLowerCase() &&
    candidate.category === request.requirements.category.trim() && candidate.color === request.requirements.color.trim() &&
    candidate.size_eu === request.requirements.size_eu;
  const total = totalPrice(candidate);
  const checks: PolicyCheck[] = [
    { key: "requirements", label: "상품 조건", passed: matches, reason: matches ? "브랜드·카테고리·색상·EU 사이즈 일치" : "후보 상품이 지정한 브랜드·카테고리·색상·사이즈와 일치하지 않습니다." },
    { key: "budget", label: "예산", passed: toUnits(total) <= toUnits(request.budget.maximum), reason: toUnits(total) <= toUnits(request.budget.maximum) ? `수수료 포함 ${usdc(total)} ≤ ${usdc(request.budget.maximum)}` : `예산 초과: 수수료 포함 총액 ${usdc(total)}이 최대 ${usdc(request.budget.maximum)}를 초과합니다.` },
    { key: "merchant", label: "허용 판매처", passed: request.allowed_merchants.includes(candidate.merchant), reason: request.allowed_merchants.includes(candidate.merchant) ? `${candidate.merchant}은 허용 목록에 있습니다.` : `미승인 판매처: ${candidate.merchant}은 허용 목록에 없습니다.` },
    { key: "deadline", label: "구매 기한", passed: Date.parse(request.deadline) > now, reason: Date.parse(request.deadline) > now ? "설정된 구매 기한 이내입니다." : "구매 기한이 지나 승인을 차단했습니다." },
  ];
  return {
    model: "qwen3-32b", source: "mock", checks, allowed: checks.every(c => c.passed),
    reasons: checks.every(c => c.passed) ? ["모든 데모 조건을 만족하므로 사용자 최종 검토를 추천합니다."] : checks.filter(c => !c.passed).map(c => c.reason),
    uncertainties: ["실제 재고·배송 가능 지역·상품 진위 미확인", "수수료는 가상 추정치이며 실시간 견적이 아닙니다.", "자유 입력 구매 목적의 의미 분석은 미연결입니다. 구조화된 상품 조건만 비교합니다."],
  };
}
export function paymentState(task: DemoTask | null) {
  const labels: Record<PurchaseStatus, string> = {
    AWAITING_APPROVAL: "사용자 승인 대기 · 결제·블록체인 실행 금지",
    APPROVED: "승인 완료 · 테스트넷 실행 대기",
    REJECTED: "REJECTED · 결제·블록체인 실행 금지",
    STOPPED: "STOPPED · 결제·블록체인 실행 금지",
    BLOCKED: "BLOCKED · 결제·블록체인 실행 금지",
    CANCELLED: "CANCELLED · 결제·블록체인 실행 금지",
  };
  return {
    label: task ? labels[task.status] : "미실행 · 연결 전",
    payment_allowed: false as const,
    blockchain_allowed: false as const,
  };
}

type Decision = "APPROVED" | "REJECTED" | "CANCELLED";
export type DemoAction =
  | { type: "RUN"; scenario: DemoScenario; request?: PurchaseRequest; now: number; expectedRun: number }
  | { type: "DECIDE"; taskId: string; decision: Decision; now: number }
  | { type: "STOP"; taskId: string; now: number }
  | { type: "EXPIRE"; taskId: string; now: number };
export const initialDemoState: DemoState = { task: null, events: [], run: 0 };

function blockedEvents(checks: PolicyCheck[]): Pick<PurchaseEvent, "type" | "title" | "detail" | "status" | "reason" | "approval">[] {
  const names = {
    budget: ["BUDGET_BLOCKED", "예산 초과 차단"],
    merchant: ["MERCHANT_BLOCKED", "미승인 판매처 차단"],
    requirements: ["REQUIREMENTS_BLOCKED", "상품 조건 불일치 차단"],
    deadline: ["DEADLINE_BLOCKED", "구매 기한 초과 차단"],
  } as const;
  return checks.filter(c => !c.passed).map(c => ({ type: names[c.key][0], title: names[c.key][1], detail: c.reason, reason: c.reason, status: "BLOCKED" }));
}
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  const stamp = new Date(action.now).toISOString();
  const append = (taskId: string, events: Pick<PurchaseEvent, "type" | "title" | "detail" | "status" | "reason" | "approval">[]) =>
    [...state.events, ...events.map((event, index) => ({ ...event, task_id: taskId, created_at: stamp, id: `demo_event_${state.events.length + index + 1}` }))];
  if (action.type === "RUN") {
    // A pending approval must be resolved before replacing the mandate.
    if (action.expectedRun !== state.run || state.task?.status === "AWAITING_APPROVAL") return state;
    const request = structuredClone(action.request ?? defaultRequest(action.now));
    if (validateRequest(request, action.now)) return state;
    const candidate = scenarioCandidate(action.scenario);
    const judgment = judgePurchase(request, candidate, action.now);
    const taskId = `demo_task_${String(state.run + 1).padStart(3, "0")}`;
    const status = judgment.allowed ? "AWAITING_APPROVAL" : "BLOCKED";
    return {
      run: state.run + 1,
      task: { task_id: taskId, source: "mock", scenario: action.scenario, request, candidate, judgment, status },
      events: append(taskId, [
        { type: "MANDATE_CREATED", title: "구매 조건 생성", detail: `${request.intent} · 최대 ${usdc(request.budget.maximum)} · 데모 ID`, status: "DEMO" },
        { type: "AI_JUDGMENT", title: "AI 데모 판단", detail: "qwen3-32b 연결 전 · 로컬 조건 비교 · 실제 모델 호출 없음", status: "DEMO" },
        { type: "POLICY_CHECK", title: "예산·판매처 정책 검사", detail: judgment.checks.map(c => `${c.label}: ${c.passed ? "충족" : "차단"}`).join(" / "), status: judgment.allowed ? "PASS" : "BLOCKED" },
        ...blockedEvents(judgment.checks),
      ]),
    };
  }
  if (action.type === "EXPIRE") {
    const task = state.task;
    if (!task || task.task_id !== action.taskId || task.status !== "AWAITING_APPROVAL" || Date.parse(task.request.deadline) > action.now) return state;
    const judgment = judgePurchase(task.request, task.candidate, action.now);
    return { ...state, task: { ...task, judgment, status: "BLOCKED" }, events: append(task.task_id, blockedEvents(judgment.checks)) };
  }
  if (action.type === "STOP") {
    const task = state.task;
    if (!task || task.task_id !== action.taskId || !["AWAITING_APPROVAL", "APPROVED"].includes(task.status)) return state;
    const reason = "사용자가 에이전트 즉시 중단(STOP) 버튼을 눌러 실행 권한을 철회했습니다.";
    return {
      ...state,
      task: { ...task, status: "STOPPED", stop: { reason, stopped_at: stamp, execution_prohibited: true } },
      events: append(task.task_id, [{
        type: "AGENT_STOPPED", title: "에이전트 즉시 중단(STOP)", status: "STOPPED", reason,
        detail: `중단 사유: ${reason} 결제·블록체인 실행 금지 · 테스트넷 연결 전`,
      }]),
    };
  }
  if (!state.task || state.task.task_id !== action.taskId || state.task.status !== "AWAITING_APPROVAL") return state;
  const task = state.task;
  if (action.decision === "APPROVED") {
    // Re-check at approval time, including deadlines that expired while waiting.
    const judgment = judgePurchase(task.request, task.candidate, action.now);
    if (!judgment.allowed) return { ...state, task: { ...task, status: "BLOCKED", judgment }, events: append(task.task_id, blockedEvents(judgment.checks)) };
  }
  const approval: ApprovalAudit | undefined = action.decision === "APPROVED" ? { approved_at: stamp, merchant: task.candidate.merchant, total: totalPrice(task.candidate), currency: "USDC", actor: "현재 사용자 (데모 · 미인증)" } : undefined;
  const reason = action.decision === "REJECTED" ? "사용자가 구매 제안을 거절했습니다." : "사용자가 전체 중단을 요청했습니다.";
  const titles = { APPROVED: "사용자 최종 승인", REJECTED: "사용자 거절", CANCELLED: "전체 중단" };
  const types = { APPROVED: "USER_APPROVED", REJECTED: "USER_REJECTED", CANCELLED: "CANCELLED" } as const;
  return {
    ...state, task: { ...task, status: action.decision, ...(approval ? { approval } : {}), ...(action.decision === "REJECTED" ? { rejection: { reason, rejected_at: stamp } } : {}) },
    events: append(task.task_id, [{ type: types[action.decision], title: titles[action.decision], status: action.decision, ...(approval ? { approval } : { reason }), detail: approval ? `판매처: ${approval.merchant} · 총액: ${usdc(approval.total)} · 승인 주체: ${approval.actor} · 승인 완료 · 테스트넷 실행 대기` : `거절·중단 사유: ${reason} 결제·블록체인 실행 금지 · 테스트넷 연결 전` }]),
  };
}
