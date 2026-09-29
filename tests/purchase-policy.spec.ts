import { test, expect } from "@playwright/test";
import { defaultRequest, scenarioCandidate } from "../src/lib/api/mock";
import { demoReducer, initialDemoState, judgePurchase, validateRequest, paymentState } from "../src/lib/purchase-demo";
import { serverTaskClient, taskApiContract } from "../src/lib/api/client";

test("policy checks include fee, exact budget, allowlist, requirements and expiry", () => {
  const now = Date.now();
  const request = defaultRequest(now);
  const candidate = scenarioCandidate("normal");
  expect(judgePurchase(request, candidate, now).allowed).toBe(true);
  expect(judgePurchase({ ...request, budget: { currency: "USDC", maximum: 108 } }, candidate, now).allowed).toBe(true);
  expect(judgePurchase({ ...request, budget: { currency: "USDC", maximum: 107.99 } }, candidate, now).allowed).toBe(false);
  expect(judgePurchase(request, scenarioCandidate("over-budget"), now).checks.find(c => c.key === "budget")?.passed).toBe(false);
  expect(judgePurchase(request, scenarioCandidate("unapproved-merchant"), now).checks.find(c => c.key === "merchant")?.passed).toBe(false);
  expect(judgePurchase({ ...request, requirements: { ...request.requirements, size_eu: 44 } }, candidate, now).allowed).toBe(false);
  expect(validateRequest({ ...request, deadline: new Date(now - 1).toISOString() }, now)).toBeTruthy();
  expect(validateRequest({ ...request, budget: { currency: "USDC", maximum: NaN } }, now)).toBeTruthy();
  expect(validateRequest({ ...request, allowed_merchants: [] }, now)).toBeTruthy();
});

test("state machine forbids duplicate decisions and checks expiry on approval", () => {
  const now = Date.now();
  const request = { ...defaultRequest(now), deadline: new Date(now + 100).toISOString() };
  const run = { type: "RUN" as const, now, request, scenario: "normal" as const, expectedRun: 0 };
  const pending = demoReducer(initialDemoState, run);
  expect(pending.events).toHaveLength(3);
  expect(demoReducer(pending, run)).toBe(pending);
  const expired = demoReducer(pending, { type: "DECIDE", taskId: pending.task!.task_id, decision: "APPROVED", now: now + 200 });
  expect(expired.task?.status).toBe("BLOCKED");
  expect(expired.events.at(-1)?.type).toBe("DEADLINE_BLOCKED");
  expect(demoReducer(expired, { type: "DECIDE", taskId: pending.task!.task_id, decision: "APPROVED", now: now + 300 })).toBe(expired);
  for (const decision of ["APPROVED", "REJECTED", "CANCELLED"] as const) {
    const finished = demoReducer(pending, { type: "DECIDE", taskId: pending.task!.task_id, decision, now: now + 10 });
    expect(finished.events).toHaveLength(4);
    expect(finished.task?.status).toBe(decision);
    expect(demoReducer(finished, { type: "DECIDE", taskId: pending.task!.task_id, decision, now: now + 20 })).toBe(finished);
  }
  const blockedRun = { ...run, scenario: "over-budget" as const };
  const blocked = demoReducer(initialDemoState, blockedRun);
  expect(blocked.task?.status).toBe("BLOCKED");
  expect(demoReducer(blocked, blockedRun)).toBe(blocked);
});

test("planned API descriptors do not execute and real transport fails closed", async () => {
  const request = defaultRequest(Date.now());
  expect(taskApiContract.create(request)).toMatchObject({ method: "POST", path: "/api/v1/tasks", body: request });
  expect(taskApiContract.execute("a/b").path).toBe("/api/v1/tasks/a%2Fb/execute");
  expect(taskApiContract.confirm("id").path).toBe("/api/v1/tasks/id/mandate/confirm");
  expect(taskApiContract.events("id").method).toBe("GET");
  expect(taskApiContract.evidence("id").method).toBe("GET");
  await expect(serverTaskClient.createTask(request)).rejects.toThrow("연결 전");
  await expect(serverTaskClient.execute("demo_task_001")).rejects.toThrow("실제 요청은 전송하지 않았습니다.");
});

test("STOP is irreversible for the task and wins over queued approval", () => {
  const now = Date.now();
  const pending = demoReducer(initialDemoState, { type: "RUN", scenario: "normal", now, expectedRun: 0 });
  const stop = { type: "STOP" as const, taskId: pending.task!.task_id, now: now + 1 };
  expect(demoReducer(initialDemoState, stop)).toBe(initialDemoState);
  for (const taskState of [pending, demoReducer(pending, { type: "DECIDE", taskId: pending.task!.task_id, decision: "APPROVED", now })]) {
    const stopped = demoReducer(taskState, stop);
    expect(stopped.task?.status).toBe("STOPPED");
    expect(stopped.task?.stop).toMatchObject({ execution_prohibited: true, stopped_at: new Date(now + 1).toISOString() });
    expect(stopped.task?.stop?.reason).toContain("실행 권한을 철회");
    expect(stopped.events.at(-1)).toMatchObject({ task_id: pending.task!.task_id, type: "AGENT_STOPPED", status: "STOPPED" });
    expect(demoReducer(stopped, stop)).toBe(stopped);
    for (const decision of ["APPROVED", "REJECTED", "CANCELLED"] as const) {
      expect(demoReducer(stopped, { type: "DECIDE", taskId: pending.task!.task_id, decision, now: now + 2 })).toBe(stopped);
    }
    const next = demoReducer(stopped, { type: "RUN", scenario: "normal", now: now + 3, expectedRun: stopped.run });
    expect(next.task?.task_id).not.toBe(stopped.task?.task_id);
    expect(demoReducer(next, stop)).toBe(next);
  }
});

test("approval audit and execution policy distinguish all terminal states", async () => {
  const now = Date.now();
  const pending = demoReducer(initialDemoState, { type: "RUN", scenario: "normal", now, expectedRun: 0 });
  const approved = demoReducer(pending, { type: "DECIDE", taskId: pending.task!.task_id, decision: "APPROVED", now: now + 1 });
  expect(approved.events.at(-1)).toMatchObject({
    title: "사용자 최종 승인", task_id: pending.task!.task_id, created_at: new Date(now + 1).toISOString(), status: "APPROVED",
    approval: { approved_at: new Date(now + 1).toISOString(), merchant: "Nike 데모 스토어", total: 108, currency: "USDC", actor: "현재 사용자 (데모 · 미인증)" },
  });
  expect(paymentState(approved.task).label).toBe("승인 완료 · 테스트넷 실행 대기");
  const rejected = demoReducer(pending, { type: "DECIDE", taskId: pending.task!.task_id, decision: "REJECTED", now: now + 2 });
  expect(rejected.events.at(-1)).toMatchObject({ status: "REJECTED", task_id: pending.task!.task_id, created_at: new Date(now + 2).toISOString(), reason: "사용자가 구매 제안을 거절했습니다." });
  expect(rejected.task?.rejection?.rejected_at).toBe(new Date(now + 2).toISOString());
  const stopped = demoReducer(pending, { type: "STOP", taskId: pending.task!.task_id, now: now + 3 });
  const budget = demoReducer(initialDemoState, { type: "RUN", scenario: "over-budget", now, expectedRun: 0 });
  const merchant = demoReducer(initialDemoState, { type: "RUN", scenario: "unapproved-merchant", now, expectedRun: 0 });
  for (const state of [approved, rejected, stopped, budget, merchant]) {
    expect(paymentState(state.task)).toMatchObject({ payment_allowed: false, blockchain_allowed: false });
    await expect(serverTaskClient.execute(state.task!.task_id)).rejects.toThrow("실제 요청은 전송하지 않았습니다.");
    for (const decision of ["APPROVED", "REJECTED", "CANCELLED"] as const) {
      expect(demoReducer(state, { type: "DECIDE", taskId: state.task!.task_id, decision, now: now + 4 })).toBe(state);
    }
    if (state.task?.status !== "APPROVED") {
      expect(paymentState(state.task).label).toContain(state.task!.status);
      expect(paymentState(state.task).label).toContain("결제·블록체인 실행 금지");
      expect(state.events.at(-1)?.reason).toBeTruthy();
    }
  }
  const next = demoReducer(rejected, { type: "RUN", scenario: "normal", now: now + 5, expectedRun: rejected.run });
  expect(demoReducer(next, { type: "DECIDE", taskId: rejected.task!.task_id, decision: "APPROVED", now: now + 6 })).toBe(next);
  const expired = demoReducer(pending, { type: "EXPIRE", taskId: pending.task!.task_id, now: Date.parse(pending.task!.request.deadline) });
  expect(expired.task?.status).toBe("BLOCKED");
  expect(expired.events.at(-1)?.reason).toContain("구매 기한");
  expect(demoReducer(expired, { type: "EXPIRE", taskId: expired.task!.task_id, now: now + 1000000000 })).toBe(expired);
});
