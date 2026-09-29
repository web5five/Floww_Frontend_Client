import { test, expect, type Page } from "@playwright/test";
import { canExecute, chatMessages, quoteForScenario, resultLabel } from "../src/lib/scenario-presentation";
import type { TaskEvent, TaskQuote, TaskView } from "../src/lib/api/task-types";

const owner = "0x1111111111111111111111111111111111111111";
const asset = { chainId: 11155111, tokenAddress: "0x2222222222222222222222222222222222222222", tokenDecimals: 6 };
const quotes: TaskQuote[] = ["a", "b", "c"].map((name, index) => ({ quoteId: `qt-${name}`, merchantId: `pharmacy-${name}`, merchantName: `약국 ${name.toUpperCase()}`, itemName: "처방 품목", totalAmountBaseUnits: ["23500000", "65000000", "18500000"][index], asset, recipientAddress: owner, quotedPayToAddress: owner, expiresAt: new Date(Date.now() + 3600000).toISOString(), evidenceMode: "fixture" }));
function makeTask(index: number, input?: { goal: string; maxAmountBaseUnits: string; expiresAt: string }): TaskView { return { taskId: `11111111-2222-4333-8444-${String(index).padStart(12, "0")}`, status: "AWAITING_APPROVAL", statusReasonCode: null, goal: input?.goal ?? "처방 품목 구매", mandate: { mandateId: "66666666-7777-4888-8999-aaaaaaaaaaaa", version: 1, status: "DRAFT", itemId: "acetaminophen-500mg-10", maxAmountBaseUnits: input?.maxAmountBaseUnits ?? "60000000", consumedBaseUnits: "0", remainingBaseUnits: input?.maxAmountBaseUnits ?? "60000000", asset, expiresAt: input?.expiresAt ?? new Date(Date.now() + 86400000).toISOString(), budgetScope: "TASK_CUMULATIVE" }, attempts: [], updatedAt: new Date().toISOString(), completedAt: null }; }
function attemptFor(task: TaskView, quote: TaskQuote) { const denied = quote.merchantId !== "pharmacy-a", reasonCode = quote.merchantId === "pharmacy-b" ? "BUDGET_EXCEEDED" : quote.merchantId === "pharmacy-c" ? "RECIPIENT_NOT_ALLOWED" : null; return { attemptId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff", mandateId: task.mandate.mandateId, mandateVersion: 1, quoteId: quote.quoteId, merchantId: quote.merchantId, status: denied ? "BLOCKED" : "POLICY_ALLOWED", amountBaseUnits: quote.totalAmountBaseUnits, recipientAddress: quote.recipientAddress, policy: { decision: denied ? "DENY" as const : "ALLOW" as const, reasonCode, message: reasonCode ? { ko: reasonCode === "BUDGET_EXCEEDED" ? "예산 초과" : "허용되지 않은 수취인", en: reasonCode } : null }, payment: { status: "NOT_ATTEMPTED", txHash: null } }; }
type Fixture = { posts: string[]; items: Map<string, TaskView> };
async function fixture(page: Page, failProposal = false, failCreate = false): Promise<Fixture> {
  const items = new Map<string, TaskView>(), posts: string[] = [];
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json: route.request().url().endsWith("/config") ? { enabled: true, mode: "team-jwt", businessReady: true } : { identity: { namespace: "eip155", address: owner }, chainId: "11155111", expiresAt: new Date(Date.now() + 3600000).toISOString() } }));
  await page.route("**/api/tasks**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, parts = path.split("/").filter(Boolean), id = parts[2];
    if (request.method() === "POST") posts.push(path);
    if (parts.length === 2 && request.method() === "POST") { expect(request.headers()["idempotency-key"]).toBeTruthy(); if (failCreate) return route.fulfill({ status: 503, json: { reasonCode: "UPSTREAM_UNAVAILABLE" } }); const task = makeTask(items.size + 1, request.postDataJSON()); items.set(task.taskId, task); return route.fulfill({ json: task }); }
    if (parts.length === 2) return route.fulfill({ json: [...items.values()] });
    const task = items.get(id);
    if (!task) return route.fulfill({ status: 404, json: { reasonCode: "NOT_FOUND" } });
    if (parts.at(-1) === "events") { const events: TaskEvent[] = [{ seq: 1, kind: "MANDATE_DRAFTED", state: "AWAITING_APPROVAL", reasonCode: null, actor: "user", createdAt: task.updatedAt }]; if (task.attempts.length) events.push({ seq: 2, kind: "POLICY_DECIDED", state: task.status, reasonCode: task.attempts[0].policy.reasonCode, actor: "server", createdAt: task.updatedAt }); return route.fulfill({ json: { events, nextCursor: events.length, hasMore: false } }); }
    if (parts.at(-1) === "quotes") return route.fulfill({ json: { taskId: id, mandateVersion: 1, quotes } });
    if (parts.at(-1) === "reject" || parts.at(-1) === "cancel") { task.status = "DECLINED"; return route.fulfill({ json: task }); }
    if (parts.at(-1) === "ai-proposal") { if (failProposal) return route.fulfill({ status: 503, json: { reasonCode: "UPSTREAM_UNAVAILABLE" } }); const attempt = attemptFor(task, quotes[0]); task.attempts = [attempt]; return route.fulfill({ json: { proposal: { status: "PROPOSED" }, attempt, reusedAttempt: false } }); }
    if (parts.at(-1) === "attempts") { const { quoteId, proposedBy } = request.postDataJSON(); expect(proposedBy).toBe("USER"); const quote = quotes.find(item => item.quoteId === quoteId)!; const attempt = attemptFor(task, quote); task.attempts = [attempt]; return route.fulfill({ json: attempt }); }
    return route.fulfill({ json: task });
  });
  return { posts, items };
}

test("presentation maps persisted facts to readable bubbles and gates stale authorization", () => {
  expect(quoteForScenario(quotes, "over-budget")?.totalAmountBaseUnits).toBe("65000000");
  expect(quoteForScenario([...quotes, quotes[1]], "over-budget")).toBeUndefined();
  const task = makeTask(1); task.attempts = [attemptFor(task, quotes[1])];
  expect(canExecute(task)).toBe(false);
  expect(resultLabel(task)).toContain("예산 초과");
  const messages = chatMessages(task, [{ seq: 1, kind: "POLICY_DECIDED", state: task.status, reasonCode: "BUDGET_EXCEEDED", actor: "server", createdAt: task.updatedAt }], quotes);
  expect(messages[0].role).toBe("user"); expect(messages.at(-1)?.body).toContain("약국 B");
  expect(messages.some(message => message.body.includes("POLICY_DECIDED"))).toBe(false);
});

test("one click completes the server check, chat resumes the same task, and two denials cannot pay", async ({ page }) => {
  const data = await fixture(page);
  await page.goto("/pharmacy");
  await expect(page.locator(".scenario-intent")).toContainText("시작 후 24시간");
  for (const [scenario, reason] of [["over-budget", "예산 초과"], ["recipient", "허용되지 않은 수취인"]] as const) {
    await page.getByRole("button", { name: new RegExp(`^0[123] ${scenario === "over-budget" ? "예산 초과" : "수취인 조건"}`) }).click();
    await expect(page.locator("#scenario-progress")).toContainText(reason);
    const taskId = [...data.items.keys()].at(-1)!;
    await expect(page.locator("#scenario-progress").getByRole("region", { name: "실제 Sepolia 구매 실행" })).toHaveCount(0);
    await page.locator("#scenario-progress").getByRole("link", { name: /대화로 보기/ }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/${taskId}`));
    await expect(page.locator(".chat-messages .user")).toContainText("처방");
    await expect(page.locator(".chat-messages .floww").last()).toContainText(reason);
    await page.getByRole("button", { name: "음성 대화 열기" }).click();
    await expect(page.getByRole("region", {name:"Floww 음성 대화"})).toBeVisible();
    await expect(page.getByRole("button", {name:"음성 대화 시작",exact:true})).toBeDisabled();
    await page.getByRole("button", { name: "음성 대화 닫기" }).click();
    await expect(page.getByRole("link", {name:/음성 화면 크게/})).toHaveAttribute("href", `/voice?taskId=${taskId}`);
    await page.getByRole("link", {name:/시나리오 화면으로 돌아가기/}).click();
    await expect(page).toHaveURL(new RegExp(`taskId=${taskId}`));
    await expect(page.locator("#scenario-progress")).toContainText(reason);
    await page.reload();
    await expect(page.locator("#scenario-progress")).toContainText(reason);
    await page.goto("/pharmacy");
  }
  await page.getByRole("button", { name: /^01 허용된 구매/ }).click();
  await expect(page.locator("#scenario-progress")).toContainText("선택한 견적을 검토");
  await expect(page.locator("#scenario-progress").getByRole("region", { name: "실제 Sepolia 구매 실행" })).toHaveCount(1);
  expect(data.posts.filter(path => path === "/api/tasks")).toHaveLength(3);
  expect(data.posts.filter(path => path.endsWith("/quotes"))).toHaveLength(3);
  expect(data.posts.filter(path => path.endsWith("/attempts"))).toHaveLength(2);
  expect(data.posts.filter(path => path.endsWith("/ai-proposal"))).toHaveLength(1);
  expect(data.posts.some(path => /payment|orders|approval/.test(path))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("unknown proposal stays locked across reload and never silently retries", async ({ page }) => {
  const data = await fixture(page, true);
  await page.goto("/pharmacy");
  await page.getByRole("button", { name: /^01 허용된 구매/ }).click();
  await expect(page.locator("#scenario-progress")).toContainText("서버 결과 확인 필요");
  await page.reload();
  await expect(page.locator("#scenario-progress")).toContainText("서버 결과 확인 필요");
  expect(data.posts.filter(path => path.endsWith("/ai-proposal"))).toHaveLength(1);
  expect(data.posts.filter(path => path === "/api/tasks")).toHaveLength(1);
});

test("unknown Task creation stays locked across reload", async ({ page }) => {
  const data = await fixture(page, false, true);
  await page.goto("/pharmacy");
  await page.getByRole("button", { name: /^01 허용된 구매/ }).click();
  await expect(page.locator("#scenario-progress")).toContainText("서버 결과 확인 필요");
  await page.reload();
  await expect(page.locator("#scenario-progress")).toContainText("서버 결과 확인 필요");
  expect(data.posts.filter(path => path === "/api/tasks")).toHaveLength(1);
});

test("STOP locks subsequent workflow requests and persists across reload", async ({ page }) => {
  const data = await fixture(page);
  await page.goto("/pharmacy");
  await page.getByRole("button", { name: /^03 수취인 조건/ }).click();
  await expect(page.locator("#scenario-progress")).toContainText("허용되지 않은 수취인");
  await page.getByRole("button", { name: "작업 중단" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "후속 실행이 잠겼습니다" })).toBeVisible();
  await expect.poll(() => [...data.items.values()][0].status).toBe("DECLINED");
  const before = data.posts.length;
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "후속 실행이 잠겼습니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^01 허용된 구매/ })).toBeEnabled();
  expect(data.posts).toHaveLength(before);
  await expect(page.locator("#scenario-progress").getByRole("region", { name: "실제 Sepolia 구매 실행" })).toHaveCount(0);
});


test("scenario chosen during login resolves once after the owner becomes available", async ({ page }) => {
  const data = await fixture(page);
  let releaseSession!: () => void;
  const sessionGate = new Promise<void>(resolve => { releaseSession = resolve; });
  await page.route("**/api/wallet-auth/session", async route => {
    await sessionGate;
    return route.fulfill({ json: { identity: { namespace: "eip155", address: owner }, chainId: "11155111", expiresAt: new Date(Date.now() + 3600000).toISOString() } });
  });
  await page.goto("/pharmacy");
  await page.getByRole("button", { name: /^03 수취인 조건/ }).click();
  expect(data.posts).toHaveLength(0);
  releaseSession();
  await expect(page.locator("#scenario-progress")).toContainText("허용되지 않은 수취인");
  expect(data.posts.filter(path => path === "/api/tasks")).toHaveLength(1);
  expect(data.posts.filter(path => path.endsWith("/attempts"))).toHaveLength(1);
  await page.reload();
  await expect(page.locator("#scenario-progress")).toContainText("허용되지 않은 수취인");
  expect(data.posts.filter(path => path === "/api/tasks")).toHaveLength(1);
});
