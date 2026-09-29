import { test, expect } from "@playwright/test";
import { accountProgress, parseAccountEvidence } from "../src/lib/api/account-evidence";
const id = "11111111-1111-4111-8111-111111111111";
const sample = { taskId: id, state: "PAYMENT_UNKNOWN", accountAddress: "0x"+"1".repeat(40), amountBaseUnits:"23500000",tokenAddress:"0x"+"2".repeat(40),paymentTxHash:"0x"+"3".repeat(64),paymentOperationState:"UNKNOWN",paymentVerifiedAt:null as string|null,fulfillmentTxHash:null as string|null,fulfillmentOperationState:null as string|null,fulfillmentVerifiedAt:null as string|null,fulfillmentEvidenceMode:null as string|null };
test("hashes, paid state and Task label do not replace verified fulfillment", () => {
  expect(accountProgress(parseAccountEvidence(sample,id),"COMPLETED").completed).toBe(false);
  const paid = {...sample,state:"PAID",paymentOperationState:"VERIFIED",paymentVerifiedAt:"2026-09-30T00:00:00Z"};
  expect(accountProgress(paid,"COMPLETED")).toEqual({paid:true,fulfilled:false,completed:false});
  const complete = {...paid,state:"COMPLETED",fulfillmentOperationState:"VERIFIED",fulfillmentTxHash:"0x"+"4".repeat(64),fulfillmentVerifiedAt:"2026-09-30T00:01:00Z",fulfillmentEvidenceMode:"local_pharmacy_simulator"};
  expect(accountProgress(parseAccountEvidence(complete,id),"COMPLETED").completed).toBe(true);
  expect(accountProgress(complete,"EXECUTING").completed).toBe(false);
  for (const change of [{taskId:"another-task"},{amountBaseUnits:23500000},{amountBaseUnits:(BigInt(1)<<BigInt(256)).toString()},{paymentTxHash:"javascript:alert(1)"}]) expect(()=>parseAccountEvidence({...sample,...change},id)).toThrow();
});
test("same-Task evidence distinguishes unknown payment from verified completion", async ({ page }) => {
  const task = { taskId: id, status: "COMPLETED", statusReasonCode: null, goal: "처방 품목 구매", mandate: { mandateId: id, version: 1, status: "CONFIRMED", itemId: "acetaminophen-500mg-10", maxAmountBaseUnits: "60000000", consumedBaseUnits: "23500000", remainingBaseUnits: "36500000", asset: { tokenDecimals: 6, chainId: 11155111, tokenAddress: sample.tokenAddress }, expiresAt: "2026-10-01T00:00:00Z", budgetScope: "TASK_CUMULATIVE" }, attempts: [], updatedAt: "2026-09-30T00:00:00Z", completedAt: "2026-09-30T00:01:00Z" };
  let evidence = { ...sample };
  const posts: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname.startsWith("/api/tasks")) posts.push(request.url()); });
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json: route.request().url().endsWith("config") ? { enabled: true, mode: "team-jwt", businessReady: true } : { identity: { namespace: "eip155", address: sample.accountAddress }, chainId: "11155111", expiresAt: new Date(Date.now() + 600000).toISOString() } }));
  await page.route("**/api/tasks/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/account")) return route.fulfill({ json: evidence });
    if (pathname.endsWith("/events")) return route.fulfill({ json: { events: [], nextCursor: 0, hasMore: false } });
    return route.fulfill({ json: task });
  });
  await page.goto(`/chat/${id}`);
  await expect(page.locator("#scenario-progress")).toContainText("처방 품목 구매");
  await page.locator("#scenario-progress > details > summary").click();
  const panel = page.getByRole("region", { name: "서버 결제 증거" });
  await panel.getByRole("button", { name: "서버 결제 증거 조회" }).click();
  await expect(panel.getByRole("status")).toContainText("완료 미확정");
  await expect(panel.getByRole("link", { name: "결제 거래" })).toHaveAttribute("href", `https://sepolia.etherscan.io/tx/${sample.paymentTxHash}`);
  evidence = { ...sample, state: "COMPLETED", paymentOperationState: "VERIFIED", paymentVerifiedAt: "2026-09-30T00:00:00Z", fulfillmentOperationState: "VERIFIED", fulfillmentTxHash: "0x" + "4".repeat(64), fulfillmentVerifiedAt: "2026-09-30T00:01:00Z", fulfillmentEvidenceMode: "local_pharmacy_simulator" };
  await panel.getByRole("button", { name: "서버 결제 증거 조회" }).click();
  await expect(panel.getByRole("status")).toContainText("서버 결제·이행 검증 완료");
  await expect(panel.getByText(/약국 수령 결과는 시뮬레이션/)).toBeVisible();
  expect(posts).toEqual([]);
});
