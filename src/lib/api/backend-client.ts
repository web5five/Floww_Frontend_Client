import type { Conversation, DraftResponse, EvidencePage, Execution, EventPage, HistoryPage, Readiness, TestMandate } from "./backend-types";

export const reasonLabels: Record<string, string> = {
  BACKEND_NOT_CONFIGURED: "백엔드 연결 설정 필요",
  BUDGET_EXCEEDED: "수수료를 포함한 총액이 예산을 초과했습니다.",
  RECIPIENT_NOT_ALLOWED: "허용되지 않은 판매처입니다.",
  ITEM_NOT_ALLOWED: "허용된 상품 조건과 일치하지 않습니다.",
  MANDATE_EXPIRED: "구매 기한이 만료되었습니다.",
  CURRENCY_MISMATCH: "결제 자산이 조건과 다릅니다.",
  QUOTE_STALE: "견적의 유효 기간이 지났습니다.",
  UNAUTHORIZED: "서버 인증 설정을 확인해 주세요.",
  PROVIDER_NOT_CONFIGURED: "서버의 모델 제공자 설정이 필요합니다.",
  UPSTREAM_UNAVAILABLE: "백엔드 응답을 받지 못했습니다. 비용 요청은 자동 재시도하지 않습니다.",
  PROVIDER_TIMEOUT: "모델 응답 시간이 초과됐습니다. 비용 요청은 자동 재시도하지 않습니다.",
  MODEL_CALL_FAILED: "모델 호출에 실패했습니다.",
  KILN_NOT_CONFIGURED: "서버의 Kiln 설정이 필요합니다.",
  MERCHANT_NOT_CONFIGURED: "서버의 판매처 연동 설정이 필요합니다.",
  INTEGRATION_FAILED: "서버 연동 처리에 실패했습니다.",
};
export function reasonText(code: string) { return reasonLabels[code] ?? "서버가 요청을 처리하지 못했습니다. 해당 코드를 팀에 확인해 주세요."; }
export function eventReason(payload: Record<string, unknown>) {
  return typeof payload.reasonCode === "string" ? payload.reasonCode : typeof payload.code === "string" ? payload.code : null;
}
export class BackendError extends Error {
  constructor(public code: string) { super(`${code} · ${reasonText(code)}`); }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/floww/${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init.headers } });
  const body = await response.json();
  if (!response.ok || body.status === "ERROR") throw new BackendError(body.reasonCode ?? body.error?.code ?? "INVALID_RESPONSE");
  return body as T;
}
const executionPath = (id: string) => `api/executions/${encodeURIComponent(id)}`;
function checkedExecution(value: Execution): Execution {
  if (!value || !/^[0-9a-f-]{36}$/i.test(value.id) || !["CREATED", "RUNNING", "REVIEWED", "REJECTED", "FAILED"].includes(value.status) || typeof value.mandate?.maxTotal !== "string" || !/^\d+(\.\d+)?$/.test(value.mandate.maxTotal) || !value.updatedAt?.endsWith("Z") || !Number.isFinite(Date.parse(value.updatedAt))) throw new BackendError("INVALID_RESPONSE");
  return value;
}
function checkedEvents(page: EventPage): EventPage {
  if (!page || !Array.isArray(page.events) || !Number.isSafeInteger(page.nextCursor) || page.nextCursor < 0 || typeof page.hasMore !== "boolean" || page.events.some(e => !Number.isSafeInteger(e.seq) || typeof e.kind !== "string" || !e.payload || typeof e.payload !== "object" || !Number.isFinite(Date.parse(e.createdAt)))) throw new BackendError("INVALID_RESPONSE");
  return page;
}
export const backend = {
  health: () => request<{ status: string }>("actuator/health"),
  readiness: () => request<Readiness>("api/integrations/readiness"),
  draft: (conversation: Conversation, signal?: AbortSignal) => request<DraftResponse>("api/ai/drafts", { method: "POST", body: JSON.stringify({ conversation }), signal }),
  create: (mandate: TestMandate, key: string, signal?: AbortSignal) => request<Execution>("api/executions", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ confirmed: true, mandate }), signal }).then(checkedExecution),
  run: (id: string, signal?: AbortSignal) => request<Execution>(`${executionPath(id)}/run`, { method: "POST", signal }).then(checkedExecution),
  list: async () => { const values = await request<Execution[]>("api/executions?limit=50"); if (!Array.isArray(values)) throw new BackendError("INVALID_RESPONSE"); return values.map(checkedExecution); },
  history: async (before?: string) => { const page = await request<HistoryPage>(`api/executions/history?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`); if (!Array.isArray(page.executions) || typeof page.hasMore !== "boolean" || (page.hasMore && typeof page.nextCursor !== "string")) throw new BackendError("INVALID_RESPONSE"); page.executions.forEach(checkedExecution); return page; },
  get: (id: string, signal?: AbortSignal) => request<Execution>(executionPath(id), { signal }).then(checkedExecution),
  events: (id: string, after = 0, signal?: AbortSignal) => request<EventPage>(`${executionPath(id)}/events?after=${after}&limit=100`, { signal }).then(checkedEvents),
  evidence: async (id: string, after = 0) => { const page = await request<EvidencePage>(`${executionPath(id)}/evidence.json?after=${after}&limit=100`); checkedExecution(page.execution); checkedEvents(page.events); if (page.execution.id !== id || typeof page.complete !== "boolean" || !Number.isSafeInteger(page.nextCursor)) throw new BackendError("INVALID_RESPONSE"); return page; },
};
