import type { TaskAttempt, TaskEvent, TaskQuote, TaskView } from "@/lib/api/task-types";
import { formatFusdc } from "@/lib/pharmacy-preview";

export type ScenarioId = "permitted" | "over-budget" | "recipient";
export type JourneyPhase = "idle" | "creating" | "quotes" | "checking" | "approval" | "blocked" | "pending" | "complete" | "closed" | "unknown" | "error";
export const scenarios: Record<ScenarioId, { title: string; summary: string; merchantId: string; mode: "ai" | "manual" }> = {
  permitted: { title: "허용된 구매", summary: "약국 후보를 비교하고 선택된 구매를 직접 승인합니다.", merchantId: "pharmacy-a", mode: "ai" },
  "over-budget": { title: "예산 초과", summary: "약국 B의 견적이 한도를 넘는지 확인합니다.", merchantId: "pharmacy-b", mode: "manual" },
  recipient: { title: "수취인 조건", summary: "약국 C의 수취인이 허용되는지 확인합니다.", merchantId: "pharmacy-c", mode: "manual" },
};
export const scenarioIds = Object.keys(scenarios) as ScenarioId[];
export function isScenarioId(value: string | undefined | null): value is ScenarioId { return !!value && Object.hasOwn(scenarios, value); }
export function quoteForScenario(quotes: TaskQuote[], scenario: ScenarioId): TaskQuote | undefined {
  const matches = quotes.filter(quote => quote.merchantId === scenarios[scenario].merchantId);
  return matches.length === 1 ? matches[0] : undefined;
}
export function merchantLabel(merchantId: string): string {
  return ({ "pharmacy-a": "약국 A", "pharmacy-b": "약국 B", "pharmacy-c": "약국 C" } as Record<string, string>)[merchantId] ?? merchantId;
}
export function latestAttempt(task: TaskView): TaskAttempt | undefined { return task.attempts.at(-1); }
export function canExecute(task: TaskView): boolean {
  const attempt = latestAttempt(task);
  return !!attempt && attempt.policy.decision === "ALLOW" && attempt.mandateId === task.mandate.mandateId
    && attempt.mandateVersion === task.mandate.version && ["AWAITING_APPROVAL", "ACTIVE", "EXECUTING"].includes(task.status);
}
export function resultLabel(task: TaskView): string {
  const attempt = latestAttempt(task);
  if (attempt?.policy.decision === "DENY") return `지출이 차단됐어요. ${attempt.policy.message?.ko ?? "구매 조건에 맞지 않습니다."}`;
  if (task.status === "COMPLETED") return "서버가 구매와 이행 확인을 완료로 기록했어요. 아래 증거를 확인하세요.";
  if (task.status === "DECLINED" || task.status === "CANCELLED") return "이 작업은 중단됐어요.";
  if (task.status === "FAILED" || task.status === "EXPIRED") return "이 작업을 계속할 수 없어요. 기록을 확인하세요.";
  if (attempt?.payment.status.includes("UNKNOWN")) return "결제 상태를 확인하고 있어요. 같은 지급을 다시 요청하지 마세요.";
  if (task.status === "EXECUTING") return "결제와 이행 확인이 진행 중이에요.";
  if (task.status === "ACTIVE") return "승인된 구매를 진행 중이에요.";
  if (canExecute(task)) return "구매 조건을 통과했어요. 선택한 견적을 검토하고 지갑에서 승인하세요.";
  return "구매 조건을 확인하고 있어요.";
}

export function phaseLabel(phase: JourneyPhase): string {
  return ({ idle: "선택 대기", creating: "요청 저장 중", quotes: "약국 견적 확인 중", checking: "구매 조건 확인 중", approval: "지갑 승인 대기", blocked: "지출 차단", pending: "작업 진행 중", complete: "완료 기록 확인", closed: "작업 종료", unknown: "서버 결과 확인 필요", error: "확인 필요" })[phase];
}

export interface ChatMessage { id: string; role: "user" | "floww"; title: string; body: string; at?: string }
function eventText(event: TaskEvent): string {
  switch (event.kind) {
    case "MANDATE_DRAFTED": return "요청을 저장했어요. 아직 지출 권한은 없습니다.";
    case "QUOTES_COLLECTED": return "약국 견적을 받아 구매 조건과 비교하고 있어요.";
    case "POLICY_DECIDED": return event.reasonCode ? "구매 조건에 맞지 않아 지출을 차단했어요." : "구매 조건 검사 결과가 기록됐어요.";
    case "APPROVAL_REQUESTED": return "선택된 구매의 지갑 승인을 준비했어요.";
    case "MANDATE_CONFIRMED": return "사용자가 선택된 구매를 승인했어요.";
    case "ACCOUNT_PREPARED": return "선택된 구매의 결제 계정을 준비했어요.";
    case "ACCOUNT_BOUND": return "지갑에서 만든 결제 계정을 확인했어요.";
    case "ORDER_CREATED": return "선택된 구매의 주문을 기록했어요.";
    case "PAYMENT_VERIFIED": return "결제 영수증을 확인했어요. 이행 확인은 별개입니다.";
    case "FULFILLMENT_VERIFIED": return "약국 이행 결과의 서버 검증을 기록했어요.";
    case "TASK_STATUS_CHANGED": return event.state === "COMPLETED" ? "서버가 작업 완료를 기록했어요." : event.state === "DECLINED" || event.state === "CANCELLED" ? "작업이 중단됐어요." : "작업 상태가 업데이트됐어요.";
    default: return "작업 기록이 업데이트됐어요.";
  }
}
export function chatMessages(task: TaskView, events: TaskEvent[], quotes: TaskQuote[]): ChatMessage[] {
  const attempt = latestAttempt(task);
  const selected = quotes.find(quote => quote.quoteId === attempt?.quoteId);
  const request: ChatMessage = { id: "request", role: "user", title: "구매 요청", body: `${task.goal} · 최대 ${formatFusdc(task.mandate.maxAmountBaseUnits)} · ${new Date(task.mandate.expiresAt).toLocaleString("ko-KR")}까지` };
  const recorded = [...new Map(events.map(event => [event.seq, event])).values()].sort((a, b) => a.seq - b.seq)
    .map(event => ({ id: `event-${event.seq}`, role: "floww" as const, title: "진행 알림", body: eventText(event), at: event.createdAt }));
  const result = attempt ? [{ id: `result-${attempt.attemptId}`, role: "floww" as const, title: attempt.policy.decision === "DENY" ? "지출 차단" : "구매 검토", body: `${selected?.merchantName ?? merchantLabel(attempt.merchantId)} · ${formatFusdc(attempt.amountBaseUnits)}. ${resultLabel(task)}` }] : [];
  return [request, ...recorded, ...result];
}
