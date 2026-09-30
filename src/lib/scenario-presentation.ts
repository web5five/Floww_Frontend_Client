import type { TaskAttempt, TaskEvent, TaskQuote, TaskView } from "@/lib/api/task-types";
import { formatFusdc } from "@/lib/pharmacy-preview";
import type { Locale } from "@/lib/i18n";

export type ScenarioId = "permitted" | "over-budget" | "recipient";
export type JourneyPhase = "idle" | "creating" | "quotes" | "checking" | "approval" | "blocked" | "pending" | "complete" | "closed" | "unknown" | "error";
export const scenarios: Record<ScenarioId, { title: string; summary: string; merchantId: string; mode: "ai" | "manual" }> = {
  permitted: { title: "허용된 구매", summary: "약국 후보를 비교하고 선택된 구매를 직접 승인합니다.", merchantId: "pharmacy-a", mode: "ai" },
  "over-budget": { title: "예산 초과", summary: "약국 B의 견적이 한도를 넘는지 확인합니다.", merchantId: "pharmacy-b", mode: "manual" },
  recipient: { title: "수취인 조건", summary: "약국 C의 수취인이 허용되는지 확인합니다.", merchantId: "pharmacy-c", mode: "manual" },
};
export const scenarioIds = Object.keys(scenarios) as ScenarioId[];
export function isScenarioId(value: string | undefined | null): value is ScenarioId { return !!value && Object.hasOwn(scenarios, value); }
export function scenarioTitle(id: ScenarioId, locale: Locale = "ko") { return locale === "ko" ? scenarios[id].title : ({ permitted: "Permitted purchase", "over-budget": "Over budget", recipient: "Recipient condition" })[id]; }
export function scenarioSummary(id: ScenarioId, locale: Locale = "ko") { return locale === "ko" ? scenarios[id].summary : ({ permitted: "Compare pharmacies and approve the selected purchase yourself.", "over-budget": "Check whether Pharmacy B's quote exceeds the limit.", recipient: "Check whether Pharmacy C's recipient is permitted." })[id]; }
export function quoteForScenario(quotes: TaskQuote[], scenario: ScenarioId): TaskQuote | undefined {
  const matches = quotes.filter(quote => quote.merchantId === scenarios[scenario].merchantId);
  return matches.length === 1 ? matches[0] : undefined;
}
export function merchantLabel(merchantId: string, locale: Locale = "ko"): string {
  const suffix = ({ "pharmacy-a": "A", "pharmacy-b": "B", "pharmacy-c": "C" } as Record<string, string>)[merchantId];
  return suffix ? `${locale === "ko" ? "약국" : "Pharmacy"} ${suffix}` : merchantId;
}
export function displayMerchant(merchantId: string, merchantName: string | undefined, locale: Locale): string {
  if (!merchantName || /^약국 [ABC]$/.test(merchantName) || /^Pharmacy [ABC]$/.test(merchantName)) return merchantLabel(merchantId, locale);
  return merchantName;
}
export function statusLabel(status: string, locale: Locale): string {
  const labels: Record<string, [string, string]> = {
    AWAITING_APPROVAL: ["승인 대기", "Awaiting approval"], ACTIVE: ["진행 중", "Active"], EXECUTING: ["실행 중", "Executing"],
    COMPLETED: ["완료", "Completed"], DECLINED: ["거절됨", "Declined"], CANCELLED: ["취소됨", "Cancelled"], FAILED: ["실패", "Failed"], EXPIRED: ["만료됨", "Expired"],
    ALLOW: ["허용", "Allowed"], DENY: ["차단", "Blocked"], NOT_ATTEMPTED: ["요청 전", "Not requested"], UNKNOWN: ["결과 확인 필요", "Result unknown"],
    PREPARED: ["준비됨", "Prepared"], BOUND: ["계정 연결됨", "Account bound"], SIGNED: ["서명됨", "Signed"], APPROVED: ["승인됨", "Approved"],
    PAID: ["지급 확인", "Payment verified"], PAYMENT_UNKNOWN: ["지급 확인 필요", "Payment unknown"], FULFILLMENT_UNKNOWN: ["이행 확인 필요", "Fulfillment unknown"],
  };
  return labels[status]?.[locale === "ko" ? 0 : 1] ?? status;
}
export function latestAttempt(task: TaskView): TaskAttempt | undefined { return task.attempts.at(-1); }
export function canExecute(task: TaskView): boolean {
  const attempt = latestAttempt(task);
  return !!attempt && attempt.policy.decision === "ALLOW" && attempt.mandateId === task.mandate.mandateId
    && attempt.mandateVersion === task.mandate.version && ["AWAITING_APPROVAL", "ACTIVE", "EXECUTING"].includes(task.status);
}
const policyReasons: Record<string, [string, string]> = {
  BUDGET_EXCEEDED: ["예산 초과", "Budget exceeded"], RECIPIENT_NOT_ALLOWED: ["허용되지 않은 수취인", "Recipient is not permitted"],
  RECIPIENT_NOT_PERMITTED: ["허용되지 않은 수취인", "Recipient is not permitted"], QUOTE_EXPIRED: ["견적 기한 만료", "Quote expired"],
  MANDATE_EXPIRED: ["승인 기한 만료", "Approval deadline expired"],
};
export function policyReason(code: string | null, locale: Locale): string {
  const pair = code ? policyReasons[code] : undefined;
  return pair ? pair[locale === "ko" ? 0 : 1] : locale === "ko" ? "구매 조건에 맞지 않습니다." : "The purchase does not meet the conditions.";
}
export function resultLabel(task: TaskView, locale: Locale = "ko"): string {
  const attempt = latestAttempt(task), en = locale === "en";
  if (attempt?.policy.decision === "DENY") {
    const bilingual = attempt.policy.message?.[locale];
    const usable = bilingual && (en ? /[A-Za-z]{3,}/.test(bilingual) && !/[가-힣]/.test(bilingual) && bilingual !== attempt.policy.reasonCode : /[가-힣]/.test(bilingual));
    const reason = usable ? bilingual : policyReason(attempt.policy.reasonCode, locale);
    return en ? `Spending blocked. ${reason}` : `지출이 차단됐어요. ${reason}`;
  }
  if (task.status === "COMPLETED") return en ? "The server recorded purchase and fulfillment verification as complete. Review the evidence below." : "서버가 구매와 이행 확인을 완료로 기록했어요. 아래 증거를 확인하세요.";
  if (task.status === "DECLINED" || task.status === "CANCELLED") return en ? "This Task has been stopped." : "이 작업은 중단됐어요.";
  if (task.status === "FAILED" || task.status === "EXPIRED") return en ? "This Task cannot continue. Review its record." : "이 작업을 계속할 수 없어요. 기록을 확인하세요.";
  if (attempt?.payment.status.includes("UNKNOWN")) return en ? "Payment status is being checked. Do not request the same payment again." : "결제 상태를 확인하고 있어요. 같은 지급을 다시 요청하지 마세요.";
  if (task.status === "EXECUTING") return en ? "Payment and fulfillment verification are in progress." : "결제와 이행 확인이 진행 중이에요.";
  if (task.status === "ACTIVE") return en ? "The approved purchase is in progress." : "승인된 구매를 진행 중이에요.";
  if (canExecute(task)) return en ? "Purchase conditions passed. Review the selected quote and approve it in your wallet." : "구매 조건을 통과했어요. 선택한 견적을 검토하고 지갑에서 승인하세요.";
  return en ? "Purchase conditions are being checked." : "구매 조건을 확인하고 있어요.";
}
export function phaseLabel(phase: JourneyPhase, locale: Locale = "ko"): string {
  const labels: Record<JourneyPhase, [string, string]> = {
    idle: ["선택 대기", "Awaiting selection"], creating: ["요청 저장 중", "Saving request"], quotes: ["약국 견적 확인 중", "Checking pharmacy quotes"], checking: ["구매 조건 확인 중", "Checking purchase conditions"], approval: ["지갑 승인 대기", "Awaiting wallet approval"], blocked: ["지출 차단", "Spending blocked"], pending: ["작업 진행 중", "Task in progress"], complete: ["완료 기록 확인", "Completion recorded"], closed: ["작업 종료", "Task closed"], unknown: ["서버 결과 확인 필요", "Server result needs checking"], error: ["확인 필요", "Needs checking"],
  };
  return labels[phase][locale === "ko" ? 0 : 1];
}
export interface ChatMessage { id: string; role: "user" | "floww"; title: string; body: string; at?: string }
function eventText(event: TaskEvent, locale: Locale): string {
  const en = locale === "en";
  switch (event.kind) {
    case "MANDATE_DRAFTED": return en ? "Request saved. No spending authority has been granted yet." : "요청을 저장했어요. 아직 지출 권한은 없습니다.";
    case "QUOTES_COLLECTED": return en ? "Pharmacy quotes received and being checked against the conditions." : "약국 견적을 받아 구매 조건과 비교하고 있어요.";
    case "POLICY_DECIDED": return event.reasonCode ? en ? "Spending was blocked because purchase conditions were not met." : "구매 조건에 맞지 않아 지출을 차단했어요." : en ? "Purchase condition check was recorded." : "구매 조건 검사 결과가 기록됐어요.";
    case "APPROVAL_REQUESTED": return en ? "Wallet approval for the selected purchase was prepared." : "선택된 구매의 지갑 승인을 준비했어요.";
    case "MANDATE_CONFIRMED": return en ? "The user approved the selected purchase." : "사용자가 선택된 구매를 승인했어요.";
    case "ACCOUNT_PREPARED": return en ? "Payment account prepared for the selected purchase." : "선택된 구매의 결제 계정을 준비했어요.";
    case "ACCOUNT_BOUND": return en ? "Wallet-created payment account verified." : "지갑에서 만든 결제 계정을 확인했어요.";
    case "ORDER_CREATED": return en ? "Order recorded for the selected purchase." : "선택된 구매의 주문을 기록했어요.";
    case "PAYMENT_VERIFIED": return en ? "Payment receipt verified. Fulfillment still needs separate verification." : "결제 영수증을 확인했어요. 이행 확인은 별개입니다.";
    case "FULFILLMENT_VERIFIED": return en ? "Server verification of pharmacy fulfillment was recorded." : "약국 이행 결과의 서버 검증을 기록했어요.";
    case "TASK_STATUS_CHANGED": return event.state === "COMPLETED" ? en ? "The server recorded Task completion." : "서버가 작업 완료를 기록했어요." : event.state === "DECLINED" || event.state === "CANCELLED" ? en ? "The Task was stopped." : "작업이 중단됐어요." : en ? "Task status was updated." : "작업 상태가 업데이트됐어요.";
    default: return en ? "Task record was updated." : "작업 기록이 업데이트됐어요.";
  }
}
export function chatMessages(task: TaskView, events: TaskEvent[], quotes: TaskQuote[], locale: Locale = "ko"): ChatMessage[] {
  const attempt = latestAttempt(task), en = locale === "en";
  const goal = en && task.goal === "이미 처방받은 의약품 1팩 구매" ? "Buy one pack of previously prescribed medicine" : task.goal;
  const deadline = new Date(task.mandate.expiresAt).toLocaleString(en ? "en-US" : "ko-KR");
  const request: ChatMessage = { id: "request", role: "user", title: en ? "Purchase request" : "구매 요청", body: en ? `${goal} · up to ${formatFusdc(task.mandate.maxAmountBaseUnits)} · until ${deadline}` : `${goal} · 최대 ${formatFusdc(task.mandate.maxAmountBaseUnits)} · ${deadline}까지` };
  const recorded = [...new Map(events.map(event => [event.seq, event])).values()].sort((a, b) => a.seq - b.seq)
    .map(event => ({ id: `event-${event.seq}`, role: "floww" as const, title: en ? "Progress update" : "진행 알림", body: eventText(event, locale), at: event.createdAt }));
  const result = attempt ? [{ id: `result-${attempt.attemptId}`, role: "floww" as const, title: attempt.policy.decision === "DENY" ? en ? "Spending blocked" : "지출 차단" : en ? "Purchase review" : "구매 검토", body: `${displayMerchant(attempt.merchantId, quotes.find(quote => quote.quoteId === attempt.quoteId)?.merchantName, locale)} · ${formatFusdc(attempt.amountBaseUnits)}. ${resultLabel(task, locale)}` }] : [];
  return [request, ...recorded, ...result];
}
