import type { TaskAttempt, TaskQuote, TaskView } from "@/lib/api/task-types";

export type ScenarioId = "permitted" | "over-budget" | "recipient";

export const scenarios: Record<ScenarioId, { title: string; summary: string; action: string; merchantId: string; mode: "ai" | "manual" }> = {
  permitted: { title: "허용된 구매", summary: "서버가 약국 후보를 제안하면 선택 견적을 검토합니다.", action: "후보 제안 요청", merchantId: "pharmacy-a", mode: "ai" },
  "over-budget": { title: "예산 초과 검사", summary: "약국 B의 서버 견적을 검사하고 예산 판정을 확인합니다.", action: "B 견적 검사", merchantId: "pharmacy-b", mode: "manual" },
  recipient: { title: "수취인 조건 검사", summary: "약국 C의 서버 견적을 검사하고 수취인 판정을 확인합니다.", action: "C 견적 검사", merchantId: "pharmacy-c", mode: "manual" },
};

export const scenarioIds = Object.keys(scenarios) as ScenarioId[];
export function isScenarioId(value: string | undefined): value is ScenarioId { return !!value && value in scenarios; }
export function quoteForScenario(quotes: TaskQuote[], scenario: ScenarioId): TaskQuote | undefined {
  const matches = quotes.filter(quote => quote.merchantId === scenarios[scenario].merchantId);
  return matches.length === 1 ? matches[0] : undefined;
}
export function latestAttempt(task: TaskView): TaskAttempt | undefined { return task.attempts.at(-1); }
export function canExecute(task: TaskView): boolean {
  const attempt = latestAttempt(task);
  return !!attempt && attempt.policy.decision === "ALLOW" && ["AWAITING_APPROVAL", "ACTIVE", "EXECUTING", "COMPLETED"].includes(task.status);
}
export function resultLabel(task: TaskView): string {
  const attempt = latestAttempt(task);
  if (attempt?.policy.decision === "DENY") return `지출 차단 · ${attempt.policy.message?.ko ?? attempt.policy.reasonCode ?? "정책 거절"}`;
  if (task.status === "COMPLETED") return "서버가 작업 완료를 기록했습니다. 결제와 이행 증거를 확인하세요.";
  if (task.status === "DECLINED" || task.status === "CANCELLED") return "작업이 중단되었습니다.";
  if (task.status === "FAILED" || task.status === "EXPIRED") return "작업을 진행할 수 없습니다. 서버 기록을 확인하세요.";
  if (attempt?.policy.decision === "ALLOW") return "정책 통과 · 선택 견적의 최종 승인이 필요합니다.";
  return "작업이 생성되었습니다. 견적과 정책 결과를 확인하세요.";
}
