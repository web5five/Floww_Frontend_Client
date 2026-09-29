import { test, expect } from "@playwright/test";
import { canExecute, quoteForScenario, resultLabel } from "../src/lib/scenario-presentation";
import type { TaskQuote, TaskView } from "../src/lib/api/task-types";

const owner = "0x1111111111111111111111111111111111111111";
const asset = { chainId: 11155111, tokenAddress: "0x2222222222222222222222222222222222222222", tokenDecimals: 6 };
const expiresAt = new Date(Date.now() + 86400000).toISOString();
const quotes: TaskQuote[] = ["a", "b", "c"].map((name, index) => ({ quoteId: `qt-${name}`, merchantId: `pharmacy-${name}`, merchantName: `약국 ${name.toUpperCase()}`, itemName: "처방 품목", totalAmountBaseUnits: ["23500000", "65000000", "18500000"][index], asset, recipientAddress: owner, quotedPayToAddress: owner, expiresAt, evidenceMode: "fixture" }));
function makeTask(index: number): TaskView { return { taskId: `11111111-2222-4333-8444-${String(index).padStart(12, "0")}`, status: "AWAITING_APPROVAL", statusReasonCode: null, goal: "처방 품목 구매", mandate: { mandateId: "66666666-7777-4888-8999-aaaaaaaaaaaa", version: 1, status: "DRAFT", itemId: "acetaminophen-500mg-10", maxAmountBaseUnits: "60000000", consumedBaseUnits: "0", remainingBaseUnits: "60000000", asset, expiresAt, budgetScope: "TASK_CUMULATIVE" }, attempts: [], updatedAt: new Date().toISOString(), completedAt: null }; }

test("overview presents three paths and a visible upper-right login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("link", { name: /시나리오 열기/ })).toHaveCount(3);
  await expect(page.getByRole("link", { name: "지갑 로그인" })).toBeVisible();
  const copy = await page.getByRole("main").innerText();
  expect(copy).not.toMatch(/mock|prototype|MVP|version 1|버전 1|프로토타입|AI.generated|AI 생성/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("scenario selectors use actual merchant quotes and denied attempts cannot execute", () => {
  expect(quoteForScenario(quotes, "over-budget")?.totalAmountBaseUnits).toBe("65000000");
  expect(quoteForScenario(quotes, "recipient")?.totalAmountBaseUnits).toBe("18500000");
  expect(quoteForScenario([...quotes, quotes[1]], "over-budget")).toBeUndefined();
  const task = makeTask(1);
  task.attempts.push({ attemptId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff", mandateId: task.mandate.mandateId, mandateVersion: 1, quoteId: quotes[1].quoteId, merchantId: quotes[1].merchantId, status: "BLOCKED", amountBaseUnits: quotes[1].totalAmountBaseUnits, recipientAddress: owner, policy: { decision: "DENY", reasonCode: "BUDGET_EXCEEDED", message: { ko: "예산 초과", en: "Budget exceeded" } }, payment: { status: "NOT_ATTEMPTED", txHash: null } });
  expect(canExecute(task)).toBe(false);
  expect(resultLabel(task)).toContain("예산 초과");
});

test("three server scenarios share task identity with chat and gate spending on policy", async ({ page }) => {
  const tasks = new Map<string, TaskView>(), posts: string[] = [];
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json: route.request().url().endsWith("/config") ? { enabled: true, mode: "team-jwt", businessReady: true } : { identity: { namespace: "eip155", address: owner }, chainId: "11155111", expiresAt: new Date(Date.now() + 3600000).toISOString() } }));
  await page.route("**/api/tasks**", async route => {
    const request = route.request(), url = new URL(request.url()), parts = url.pathname.split("/").filter(Boolean), id = parts[2];
    if (request.method() === "POST") posts.push(url.pathname);
    if (parts.length === 2 && request.method() === "POST") { const task = makeTask(tasks.size + 1); tasks.set(task.taskId, task); return route.fulfill({ json: task }); }
    if (parts.length === 2) return route.fulfill({ json: [...tasks.values()] });
    const task = tasks.get(id);
    if (!task) return route.fulfill({ status: 404, json: { reasonCode: "NOT_FOUND" } });
    if (parts.at(-1) === "events") return route.fulfill({ json: { events: [{ seq: 1, kind: "TASK_CREATED", state: task.status, reasonCode: null, actor: "SERVER", createdAt: task.updatedAt }], nextCursor: 1, hasMore: false } });
    if (parts.at(-1) === "quotes") return route.fulfill({ json: { taskId: id, mandateVersion: 1, quotes } });
    if (parts.at(-1) === "reject" || parts.at(-1) === "cancel") { task.status = "DECLINED"; return route.fulfill({ json: task }); }
    if (parts.at(-1) === "ai-proposal") { const quote = quotes[0]; const attempt = { attemptId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff", mandateId: task.mandate.mandateId, mandateVersion: 1, quoteId: quote.quoteId, merchantId: quote.merchantId, status: "PROPOSED", amountBaseUnits: quote.totalAmountBaseUnits, recipientAddress: quote.recipientAddress, policy: { decision: "ALLOW", reasonCode: null, message: null }, payment: { status: "NOT_ATTEMPTED", txHash: null } } as const; task.attempts = [attempt]; return route.fulfill({ json: { proposal: { status: "PROPOSED" }, attempt, reusedAttempt: false } }); }
    if (parts.at(-1) === "attempts") { const { quoteId, proposedBy } = request.postDataJSON(); expect(proposedBy).toBe("USER"); const quote = quotes.find(item => item.quoteId === quoteId)!; const reasonCode = quote.merchantId === "pharmacy-b" ? "BUDGET_EXCEEDED" : "RECIPIENT_NOT_ALLOWED"; const attempt = { attemptId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff", mandateId: task.mandate.mandateId, mandateVersion: 1, quoteId, merchantId: quote.merchantId, status: "BLOCKED", amountBaseUnits: quote.totalAmountBaseUnits, recipientAddress: quote.recipientAddress, policy: { decision: "DENY", reasonCode, message: { ko: reasonCode === "BUDGET_EXCEEDED" ? "예산 초과" : "허용되지 않은 수취인", en: reasonCode } }, payment: { status: "NOT_ATTEMPTED", txHash: null } } as const; task.attempts = [attempt]; return route.fulfill({ json: attempt }); }
    return route.fulfill({ json: task });
  });
  for (const [scenario, label, reason] of [["over-budget", "예산 초과 검사", "예산 초과"], ["recipient", "수취인 조건 검사", "허용되지 않은 수취인"]] as const) {
    await page.goto(`/pharmacy?scenario=${scenario}`);
    await page.getByRole("button", { name: new RegExp(label) }).click();
    await page.getByRole("button", { name: /서버 작업 만들기/ }).click();
    const panel = page.locator("#scenario-progress");
    await expect(panel).toContainText("견적 확인 전");
    await panel.getByRole("button", { name: "서버 견적 조회" }).click();
    await panel.getByRole("button", { name: scenario === "over-budget" ? "B 견적 검사" : "C 견적 검사" }).click();
    await expect(panel).toContainText(reason);
    await expect(panel.getByRole("region", { name: "실제 Sepolia 구매 실행" })).toHaveCount(0);
    const id = [...tasks.keys()].at(-1)!;
    await panel.getByRole("link", { name: /대화형 진행/ }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/${id}`));
    await expect(page.locator("#scenario-progress")).toContainText(reason);
    await page.reload();
    await expect(page.locator("#scenario-progress")).toContainText(reason);
  }
  await page.goto("/pharmacy?scenario=permitted");
  await page.getByRole("button", { name: /서버 작업 만들기/ }).click();
  const panel = page.locator("#scenario-progress");
  await panel.getByRole("button", { name: "후보 제안 요청" }).click();
  await expect(panel).toContainText("정책 통과");
  await expect(panel.getByRole("region", { name: "실제 Sepolia 구매 실행" })).toHaveCount(1);
  await panel.getByRole("link", { name: /대화형 진행/ }).click();
  await expect(page.locator("#scenario-progress").getByRole("region", { name: "실제 Sepolia 구매 실행" })).toHaveCount(1);
  await page.waitForTimeout(1000);
  await expect(page.locator("#scenario-progress")).toContainText("정책 통과");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/f033b-chat-${test.info().project.name}.png`, fullPage: true });
  await page.locator("#scenario-progress").getByRole("button", { name: "작업 중단" }).click();
  await expect(page.locator("#scenario-progress").getByRole("region", { name: "실제 Sepolia 구매 실행" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#scenario-progress")).toContainText("작업이 중단되었습니다");
  await page.locator("#scenario-progress").getByRole("button", { name: "상태 새로고침" }).click();
  expect(posts.filter(path => path === "/api/tasks")).toHaveLength(3);
  expect(posts.filter(path => path.endsWith("/attempts"))).toHaveLength(2);
  expect(posts.filter(path => path.endsWith("/ai-proposal"))).toHaveLength(1);
  expect(posts.some(path => /account|payment|orders|approval/.test(path))).toBe(false);
});
