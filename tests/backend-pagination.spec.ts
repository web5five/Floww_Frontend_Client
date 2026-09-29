import { test, expect } from "@playwright/test";
import { chatMessages } from "../src/lib/scenario-presentation";
import type { TaskView } from "../src/lib/api/task-types";

test("chat event pagination displays ordered, unique server events without raw codes", () => {
  const task: TaskView = { taskId: "11111111-1111-4111-8111-111111111111", status: "AWAITING_APPROVAL", statusReasonCode: null, goal: "처방 품목 구매", mandate: { mandateId: "22222222-2222-4222-8222-222222222222", version: 1, status: "DRAFT", itemId: "acetaminophen-500mg-10", maxAmountBaseUnits: "60000000", consumedBaseUnits: "0", remainingBaseUnits: "60000000", asset: { chainId: 11155111, tokenAddress: "0x" + "1".repeat(40), tokenDecimals: 6 }, expiresAt: "2026-10-01T00:00:00Z", budgetScope: "TASK_CUMULATIVE" }, attempts: [], updatedAt: "2026-09-30T00:00:00Z", completedAt: null };
  const event = (seq: number) => ({ seq, kind: "QUOTES_COLLECTED", state: "AWAITING_APPROVAL", reasonCode: null, actor: "server", createdAt: "2026-09-30T00:00:00Z" });
  const bubbles = chatMessages(task, [event(2), event(1), event(2)], []);
  expect(bubbles.map(item => item.id)).toEqual(["request", "event-1", "event-2"]);
  expect(bubbles.map(item => item.body).join(" ")).not.toContain("QUOTES_COLLECTED");
});
