import type { ApiSuccess, DashboardData, FlowwTaskClient, PurchaseRequest } from "./types";

/** Existing local mock route only. This does not call Floww_Server or Kiln. */
export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const response = await fetch("/api/dashboard", { cache: "no-store", signal });
  if (!response.ok) throw new Error("데모 데이터를 불러오지 못했습니다.");
  const payload: ApiSuccess<DashboardData> = await response.json();
  if (payload.data.source !== "mock" || payload.data.connection !== "not-connected") throw new Error("데모 데이터 형식이 아닙니다.");
  return payload.data;
}
export const connectionNotice = "로컬 데모 · MOCK DATA";

/** Design references only. No request is sent by these descriptor factories. */
const taskPath = (id: string) => `/api/v1/tasks/${encodeURIComponent(id)}`;
export const taskApiContract = {
  create: (body: PurchaseRequest) => ({ method: "POST", path: "/api/v1/tasks", body } as const),
  confirm: (id: string) => ({ method: "POST", path: `${taskPath(id)}/mandate/confirm` } as const),
  execute: (id: string) => ({ method: "POST", path: `${taskPath(id)}/execute` } as const),
  get: (id: string) => ({ method: "GET", path: taskPath(id) } as const),
  events: (id: string) => ({ method: "GET", path: `${taskPath(id)}/events` } as const),
  cancel: (id: string) => ({ method: "POST", path: `${taskPath(id)}/cancel` } as const),
  evidence: (id: string) => ({ method: "GET", path: `${taskPath(id)}/evidence` } as const),
};
async function notConnected(): Promise<never> {
  throw new Error("Floww_Server 연결 전입니다. 실제 요청은 전송하지 않았습니다.");
}
/** Fail closed even when a base URL is supplied. Replace after contract/auth review. */
export const serverTaskClient: FlowwTaskClient = {
  createTask: notConnected, confirmMandate: notConnected, execute: notConnected,
  getTask: notConnected, getEvents: notConnected, cancel: notConnected, getEvidence: notConnected,
};
