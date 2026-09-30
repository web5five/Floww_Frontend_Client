import { test, expect, type Page } from "@playwright/test";
import { id } from "ethers";
import { reviewDigest, type TaskAccount } from "../src/lib/api/task-account";
import type { TaskView } from "../src/lib/api/task-types";

const owner = "0x1111111111111111111111111111111111111111";
const otherOwner = "0x9999999999999999999999999999999999999999";
const taskId = "11111111-2222-4333-8444-555555555555";
const otherTaskId = "22222222-3333-4444-8555-666666666666";
const mandateId = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const attemptId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const address = (digit: string) => `0x${digit.repeat(40)}`;
const hash = (digit: string) => `0x${digit.repeat(64)}`;

function fixture(idValue = taskId, state: "unprepared" | "APPROVED" | "PAYMENT_UNKNOWN" | "PAID" = "APPROVED", accountOwner = owner) {
  const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 3600000).toISOString();
  const task: TaskView = {
    taskId: idValue, status: state === "unprepared" ? "AWAITING_APPROVAL" : state === "APPROVED" ? "ACTIVE" : "EXECUTING",
    statusReasonCode: null, goal: "Buy one pack", mandate: {
      mandateId, version: 1, status: state === "unprepared" ? "DRAFT" : "CONFIRMED", itemId: "acetaminophen-500mg-10",
      maxAmountBaseUnits: "60000000", consumedBaseUnits: state === "PAYMENT_UNKNOWN" || state === "PAID" ? "23500000" : "0",
      remainingBaseUnits: state === "PAYMENT_UNKNOWN" || state === "PAID" ? "36500000" : "60000000",
      asset: { chainId: 11155111, tokenAddress: address("2"), tokenDecimals: 6 }, expiresAt, budgetScope: "TASK_CUMULATIVE",
    },
    attempts: [{
      attemptId, mandateId, mandateVersion: 1, quoteId: "qt_a_20260930", merchantId: "pharmacy-a",
      status: state === "unprepared" ? "POLICY_ALLOWED" : state === "APPROVED" ? "APPROVED" : "ORDERED",
      amountBaseUnits: "23500000", recipientAddress: address("3"),
      policy: { decision: "ALLOW", reasonCode: null, message: null },
      payment: { status: state === "PAYMENT_UNKNOWN" ? "UNKNOWN" : state === "PAID" ? "PAID" : "NOT_ATTEMPTED", txHash: state === "PAYMENT_UNKNOWN" || state === "PAID" ? hash("b") : null },
      order: state === "PAYMENT_UNKNOWN" || state === "PAID" ? { orderId: "dddddddd-eeee-4fff-8000-111111111111", status: "ACCEPTED", paymentStatus: state === "PAID" ? "PAID" : "UNKNOWN" } : null,
    }], updatedAt: new Date().toISOString(), completedAt: null,
  };
  const account: TaskAccount = {
    taskId: idValue, attemptId, state: state === "unprepared" ? "PREPARED" : state,
    ownerAddress: accountOwner, accountAddress: address("6"), deployTxHash: hash("a"),
    chainTaskId: id(`floww:task:${idValue}`), reviewSnapshotDigest: reviewDigest(task, task.attempts[0], expiresAt),
    amountBaseUnits: "23500000", tokenAddress: address("2"), recipientAddress: address("3"),
    executorAddress: address("4"), fulfillmentReporter: address("5"), quoteExpiresAt: expiresAt, expiresAt,
    deploymentData: null, approvalDigest: hash("c"), approvalTxHash: hash("d"), approvalOperationState: "VERIFIED",
    paymentTxHash: state === "PAYMENT_UNKNOWN" || state === "PAID" ? hash("b") : null,
    paymentOperationState: state === "PAYMENT_UNKNOWN" ? "UNKNOWN" : state === "PAID" ? "VERIFIED" : null,
    paymentVerifiedAt: state === "PAID" ? new Date().toISOString() : null,
    fulfillmentTxHash: null, fulfillmentOperationState: null, fulfillmentVerifiedAt: null, fulfillmentEvidenceMode: null,
  };
  return { task, account };
}

type ApiFixture = { posts: string[]; gets: string[]; setAccountFailure: (status: number | null) => void; release: () => void };
async function mockApi(page: Page, records: ReturnType<typeof fixture>[], options: { accountFailure?: number; holdTask?: string } = {}): Promise<ApiFixture> {
  const posts: string[] = [], gets: string[] = [];
  let accountFailure = options.accountFailure ?? null;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json: route.request().url().endsWith("/config")
    ? { enabled: true, mode: "team-jwt", businessReady: true, chainIds: ["11155111"] }
    : { identity: { namespace: "eip155", address: owner }, chainId: "11155111", expiresAt: new Date(Date.now() + 3600000).toISOString() } }));
  await page.route("**/api/tasks**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST") posts.push(path); else gets.push(path);
    if (request.method() === "POST") return route.fulfill({ status: 409, json: { reasonCode: "INVALID_STATE_TRANSITION" } });
    if (path === "/api/tasks") return route.fulfill({ json: records.map(record => record.task) });
    const record = records.find(item => path.includes(`/${item.task.taskId}`));
    if (!record) return route.fulfill({ status: 404, json: { reasonCode: "TASK_NOT_FOUND" } });
    if (path.endsWith("/events")) return route.fulfill({ json: { events: [], nextCursor: 0, hasMore: false } });
    if (path.endsWith("/account")) {
      if (accountFailure) return route.fulfill({ status: accountFailure, json: { reasonCode: accountFailure === 409 ? "CHAIN_NOT_READY" : "UPSTREAM_UNAVAILABLE" } });
      if (record.task.status === "AWAITING_APPROVAL") return route.fulfill({ status: 409, json: { reasonCode: "CHAIN_NOT_READY" } });
      return route.fulfill({ json: record.account });
    }
    if (options.holdTask === record.task.taskId) await gate;
    return route.fulfill({ json: record.task });
  });
  return { posts, gets, setAccountFailure: value => { accountFailure = value; }, release };
}

const execution = (page: Page) => page.getByRole("region", { name: "실제 Sepolia 구매 실행" });
const noMutation = (fixture: ApiFixture) => expect(fixture.posts.filter(path => /\/(prepare|bind|signature|approve|orders|payment|fulfillment)$/.test(path))).toEqual([]);

test("return and reload restore an approved account without preparing or sending", async ({ page }) => {
  const record = fixture();
  const api = await mockApi(page, [record]);
  await page.goto(`/chat/${taskId}`);
  await expect(execution(page).getByRole("button", { name: "서버 충전 잔액 조회" })).toBeVisible();
  await expect(execution(page).getByRole("button", { name: /위임 승인 준비/ })).toHaveCount(0);
  await page.goto(`/journey/${taskId}/approval`);
  await expect(execution(page).getByRole("button", { name: "서버 충전 잔액 조회" })).toBeVisible();
  await page.reload();
  await expect(execution(page).getByRole("button", { name: "서버 충전 잔액 조회" })).toBeVisible();
  expect(api.gets.filter(path => path.endsWith(`/${taskId}/account`)).length).toBeGreaterThanOrEqual(3);
  noMutation(api);
});

test("payment UNKNOWN and PAID restore the same transaction hash without a second payment", async ({ page }) => {
  const record = fixture(taskId, "PAYMENT_UNKNOWN");
  const api = await mockApi(page, [record]);
  await page.goto(`/chat/${taskId}`);
  await expect(execution(page).getByRole("button", { name: /제출된 거래 영수증 재확인/ })).toBeVisible();
  await expect(execution(page).getByRole("button", { name: /위임 승인 준비/ })).toHaveCount(0);
  noMutation(api);
  record.task.status = "EXECUTING"; record.task.attempts[0].payment.status = "PAID";
  record.account.state = "PAID"; record.account.paymentOperationState = "VERIFIED"; record.account.paymentVerifiedAt = new Date().toISOString();
  await page.reload();
  await expect(execution(page).getByRole("button", { name: "약국 이행 확인" })).toBeVisible();
  await expect(execution(page)).toContainText("지급 검증 완료");
  expect(record.account.paymentTxHash).toBe(hash("b"));
  noMutation(api);
});

test("only an eligible unprepared Task treats CHAIN_NOT_READY as no account", async ({ page }) => {
  const record = fixture(taskId, "unprepared");
  const api = await mockApi(page, [record]);
  await page.goto(`/chat/${taskId}`);
  await expect(execution(page).getByRole("button", { name: /위임 승인 준비/ })).toBeVisible();
  await expect(execution(page)).toContainText("체인 연결 상태도 확인하세요");
  noMutation(api);
  record.task.status = "ACTIVE";
  api.setAccountFailure(409);
  await page.reload();
  await expect(execution(page).getByText(/현재 계정 상태를 확인하지 못했습니다/)).toBeVisible();
  await expect(execution(page).getByRole("button", { name: /위임 승인 준비/ })).toHaveCount(0);
  noMutation(api);
});

test("failed read-only restoration locks mutation until a successful manual retry", async ({ page }) => {
  const record = fixture();
  const api = await mockApi(page, [record], { accountFailure: 503 });
  await page.goto(`/chat/${taskId}`);
  await expect(execution(page).getByRole("button", { name: /다시 조회/ })).toBeEnabled();
  await expect(execution(page).getByRole("button", { name: /위임 승인 준비/ })).toHaveCount(0);
  api.setAccountFailure(null);
  await execution(page).getByRole("button", { name: /다시 조회/ }).click();
  await expect(execution(page).getByRole("button", { name: "서버 충전 잔액 조회" })).toBeVisible();
  noMutation(api);
});

test("saved unknown server operation and wallet hash survive a same-state restore", async ({ page }) => {
  const record = fixture();
  const api = await mockApi(page, [record]);
  const walletKey = `floww-account-wallet:${owner.toLowerCase()}:${taskId}`;
  const serverKey = `floww-account-server:${owner.toLowerCase()}:${taskId}`;
  await page.addInitScript(({ walletKey, serverKey }) => {
    sessionStorage.setItem(walletKey, JSON.stringify({ kind: "allowance", hash: `0x${"a".repeat(64)}`, confirmed: false, at: new Date().toISOString(), dataHash: `0x${"c".repeat(64)}` }));
    sessionStorage.setItem(serverKey, JSON.stringify({ action: "payment", fromState: "APPROVED" }));
  }, { walletKey, serverKey });
  await page.goto(`/chat/${taskId}`);
  await expect(execution(page)).toContainText("서버 거래 결과를 확인하지 못했습니다");
  await expect(execution(page).getByRole("link", { name: "Sepolia 거래 확인 ↗" })).toHaveAttribute("href", `https://sepolia.etherscan.io/tx/${hash("a")}`);
  expect(await page.evaluate(key => sessionStorage.getItem(key), walletKey)).toContain(hash("a"));
  expect(await page.evaluate(key => sessionStorage.getItem(key), serverKey)).toContain("payment");
  noMutation(api);
});

test("owner mismatch blocks restored actions until a validated read-only retry", async ({ page }) => {
  const record = fixture(taskId, "APPROVED", otherOwner);
  const api = await mockApi(page, [record]);
  await page.goto(`/chat/${taskId}`);
  await expect(execution(page).getByRole("button", { name: /다시 조회/ })).toBeEnabled();
  await expect(execution(page).getByRole("button", { name: "서버 충전 잔액 조회" })).toHaveCount(0);
  record.account.ownerAddress = owner;
  await execution(page).getByRole("button", { name: /다시 조회/ }).click();
  await expect(execution(page).getByRole("button", { name: "서버 충전 잔액 조회" })).toBeVisible();
  noMutation(api);
});

test("a late response from the previous Task cannot replace the current account", async ({ page }) => {
  const old = fixture(taskId, "APPROVED", otherOwner), next = fixture(otherTaskId, "APPROVED");
  next.account.accountAddress = address("7");
  const api = await mockApi(page, [old, next], { holdTask: taskId });
  await page.goto(`/chat/${taskId}`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => api.gets.some(path => path === `/api/tasks/${taskId}`)).toBe(true);
  await page.goto(`/chat/${otherTaskId}`, { waitUntil: "domcontentloaded" });
  await expect(execution(page).getByRole("button", { name: "서버 충전 잔액 조회" })).toBeVisible();
  api.release();
  await execution(page).getByText("거래 근거와 주소").click();
  await expect(execution(page)).toContainText(address("7"));
  await expect(execution(page)).not.toContainText(otherOwner);
  noMutation(api);
});
