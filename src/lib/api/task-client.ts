import { isBaseUnits, type TaskView, type TaskInput, type TaskQuote, type TaskEventPage, type TaskAttempt } from "./task-types";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (v: unknown) => typeof v === "string" && v.endsWith("Z") && Number.isFinite(Date.parse(v));
export const taskErrors: Record<string, string> = {
  TASK_CONNECTION_NOT_CONFIGURED: "백엔드 연결 설정 필요 · 지갑 JWT 업무 API 설정을 확인하세요.",
  BACKEND_NOT_CONFIGURED: "백엔드 연결 설정 필요", UNAUTHORIZED: "지갑 로그인이 필요하거나 세션이 만료되었습니다.",
  BACKEND_ACCESS_PROTECTED: "백엔드 Preview 접근 보호 상태입니다. 공개 연동 주소 또는 서버 접근 설정이 필요합니다.",
  UPSTREAM_UNAVAILABLE: "서버 응답을 확인하지 못했습니다. 생성 결과는 내 작업 조회로 확인하세요. 모델 호출은 자동 재시도하지 않습니다.",
  INVALID_RESPONSE: "서버 응답이 현재 계약과 다릅니다. 실제 상태를 확인하기 전 실행하지 않습니다.",
};
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/tasks${path}`, { ...init, cache: "no-store" });
  let data; try { data = await response.json(); } catch { throw new Error(taskErrors.INVALID_RESPONSE); }
  if (!response.ok) { const code = data.reasonCode ?? data.error?.code ?? "INVALID_RESPONSE"; throw new Error(`${code} · ${taskErrors[code] ?? data.message?.ko ?? "요청을 처리할 수 없습니다."}`); }
  return data;
}
function checkedTask(t: TaskView): TaskView {
  if (!t || !uuid.test(t.taskId) || !["AWAITING_APPROVAL", "ACTIVE", "EXECUTING", "DECLINED", "CANCELLED", "EXPIRED", "COMPLETED", "FAILED"].includes(t.status) || !uuid.test(t.mandate?.mandateId) || !Number.isSafeInteger(t.mandate.version) || t.mandate.version < 1 || ![t.mandate.maxAmountBaseUnits, t.mandate.consumedBaseUnits, t.mandate.remainingBaseUnits].every(isBaseUnits) || t.mandate.asset?.tokenDecimals !== 6 || t.mandate.asset.chainId !== 11155111 || !/^0x[0-9a-f]{40}$/i.test(t.mandate.asset.tokenAddress) || !Array.isArray(t.attempts) || !t.attempts.every(a => isBaseUnits(a.amountBaseUnits) && ["ALLOW", "DENY"].includes(a.policy?.decision) && typeof a.payment?.status === "string") || !date(t.updatedAt) || !date(t.mandate.expiresAt)) throw new Error(taskErrors.INVALID_RESPONSE);
  return t;
}
const path = (id: string) => { if (!uuid.test(id)) throw new Error("Invalid task ID"); return `/${id}`; };
export const tasks = {
  list: async (signal?: AbortSignal) => { const list = await request<TaskView[]>("?limit=20", { signal }); if (!Array.isArray(list)) throw new Error(taskErrors.INVALID_RESPONSE); return list.map(checkedTask); },
  get: (id: string, signal?: AbortSignal) => request<TaskView>(path(id), { signal }).then(checkedTask),
  create: (data: TaskInput, key: string) => request<TaskView>("", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(data) }).then(checkedTask),
  quotes: async (id: string) => { const data = await request<{ taskId: string; mandateVersion: number; quotes: TaskQuote[] }>(`${path(id)}/quotes`, { method: "POST" }); if (data.taskId !== id || !Array.isArray(data.quotes) || !data.quotes.every(q => isBaseUnits(q.totalAmountBaseUnits) && q.asset?.tokenDecimals === 6 && date(q.expiresAt))) throw new Error(taskErrors.INVALID_RESPONSE); return data; },
  proposal: (id: string) => request<{ proposal: { status: string; reasonCode?: string }; attempt: TaskAttempt | null; reusedAttempt: boolean }>(`${path(id)}/ai-proposal`, { method: "POST" }),
  stop: (id: string, status: string) => request<TaskView>(`${path(id)}/${status === "AWAITING_APPROVAL" ? "mandate/reject" : "cancel"}`, { method: "POST" }).then(checkedTask),
  events: async (id: string, after: number, signal?: AbortSignal) => { const data = await request<TaskEventPage>(`${path(id)}/events?after=${after}&limit=50`, { signal }); if (!Array.isArray(data.events) || !Number.isSafeInteger(data.nextCursor) || data.nextCursor < after || typeof data.hasMore !== "boolean" || !data.events.every(e => Number.isSafeInteger(e.seq) && date(e.createdAt))) throw new Error(taskErrors.INVALID_RESPONSE); return data; },
};
