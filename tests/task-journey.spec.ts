import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { toBaseUnits } from "../src/lib/api/task-types";
import { initialRehearsal, rehearsalReducer } from "../src/lib/demo-evidence";

test("task boundary rejects spending routes and preserves exact amounts", () => {
  expect(toBaseUnits("60")).toBe("60000000");
  expect(toBaseUnits("9007199254740993.000001")).toBe("9007199254740993000001");
  for (const input of ["0", "-1", "1e3", "1.0000001", "01"]) expect(() => toBaseUnits(input)).toThrow();
  expect(execFileSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "tests/task-proxy.mjs"], { encoding: "utf8", timeout: 30000 })).toContain("checks passed");
  const stopped = rehearsalReducer(initialRehearsal, { type: "stop", at: "2026-09-30T00:00:00Z" });
  expect(rehearsalReducer(stopped, { type: "check", at: "2026-09-30T00:00:01Z" })).toBe(stopped);
});
test("pharmacy rehearsal separates DENY, review and actual evidence", async ({ page }) => {
  const posts: string[] = []; page.on("request", r => { if (r.method() === "POST") posts.push(r.url()); });
  await page.goto("/pharmacy");
  const panel = page.locator("#pharmacy-policy:visible");
  await expect(panel).toHaveCount(1);
  await expect(panel.getByRole("radio")).toHaveCount(3);
  await panel.getByRole("radio", { name: /예산 초과/ }).check();
  await panel.getByRole("button", { name: "로컬 정책 검사", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("DENY");
  await expect(panel.getByRole("button", { name: /승인 흐름 연습/ })).toBeDisabled();
  await panel.getByRole("radio", { name: /잘못된 수신자/ }).check();
  await panel.getByRole("button", { name: "로컬 정책 검사", exact: true }).click();
  await expect(panel.getByRole("list", { name: "리허설 기록" })).toContainText("RECIPIENT_NOT_ALLOWED");
  await panel.getByRole("radio", { name: /정상 조건/ }).check();
  await panel.getByRole("button", { name: "로컬 정책 검사", exact: true }).click();
  await panel.getByRole("button", { name: /승인 흐름 연습/ }).evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect(panel.getByRole("listitem")).toHaveCount(4);
  await expect(page.locator("#pharmacy-evidence")).toContainText("실제 E2E 검증 대기");
  await panel.getByRole("button", { name: "리허설 중단(STOP)", exact: true }).click();
  await expect(panel.getByRole("radio").first()).toBeDisabled();
  const download = page.waitForEvent("download"); await panel.getByRole("button", { name: "로컬 리허설 기록 다운로드" }).click();
  expect((await download).suggestedFilename()).toBe("floww-local-rehearsal.json");
  expect(posts).toEqual([]);
});
test("server tasks create once, show DENY and never request spending authorization", async ({ page }) => {
  const id = "11111111-1111-4111-8111-111111111111", mid = "22222222-2222-4222-8222-222222222222";
  const task = { taskId: id, status: "AWAITING_APPROVAL", statusReasonCode: null, goal: "fixture", mandate: { mandateId: mid, version: 1, status: "DRAFT", itemId: "acetaminophen-500mg-10", maxAmountBaseUnits: "60000000", consumedBaseUnits: "0", remainingBaseUnits: "60000000", asset: { chainId: 11155111, tokenAddress: "0x"+"1".repeat(40), tokenDecimals: 6 }, expiresAt: new Date(Date.now()+86400000).toISOString(), budgetScope: "TASK_CUMULATIVE" }, attempts: [] as object[], updatedAt: new Date().toISOString(), completedAt: null };
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json: route.request().url().endsWith("config") ? { enabled: true, mode: "team-jwt", businessReady: true } : { identity: { namespace: "eip155", address: "0x"+"1".repeat(40) }, chainId: "11155111", expiresAt: new Date(Date.now()+600000).toISOString() } }));
  const mutations: string[] = [];
  await page.route("**/api/tasks**", async route => {
    const request=route.request(), url=new URL(request.url());
    if(request.method()==="POST") mutations.push(url.pathname);
    if(url.pathname.endsWith("events")) return route.fulfill({json:{events:[],nextCursor:0,hasMore:false}});
    if(url.pathname.endsWith("ai-proposal")) { task.attempts=[{attemptId:mid,amountBaseUnits:"64000000",merchantId:"pharmacy-b",status:"BLOCKED",policy:{decision:"DENY",reasonCode:"BUDGET_EXCEEDED",message:{ko:"예산 초과",en:"Budget exceeded"}},payment:{status:"NOT_ATTEMPTED",txHash:null}}]; return route.fulfill({json:{proposal:{status:"PROPOSED"},attempt:task.attempts[0],reusedAttempt:false}}); }
    if(url.pathname.endsWith("mandate/reject")) task.status="DECLINED";
    if(url.pathname==="/api/tasks" && request.method()==="GET") return route.fulfill({json:[task]});
    if(url.pathname==="/api/tasks" && request.method()==="POST") { expect(request.postDataJSON().maxAmountBaseUnits).toBe("60000000"); expect(request.headers()["idempotency-key"]).toBeTruthy(); }
    return route.fulfill({json:task});
  });
  await page.goto("/pharmacy"); const panel=page.locator("#server-task");
  await panel.getByLabel(/購入|구매 기한/).fill("2026-10-03T12:00");
  await panel.getByRole("button",{name:"서버 Task 생성",exact:true}).evaluate((b:HTMLButtonElement)=>{b.click();b.click();});
  await expect(panel).toContainText(id);
  await panel.getByRole("button",{name:/Kiln 제안 요청/}).click();
  await expect(panel).toContainText("BUDGET_EXCEEDED");
  await expect(panel.getByRole("button",{name:/Mandate 확인/})).toBeDisabled();
  await panel.getByRole("button",{name:"에이전트 즉시 중단(STOP)",exact:true}).click();
  await expect(panel).toContainText("서버 상태: DECLINED");
  await page.reload(); await panel.getByRole("button",{name:"내 작업 조회",exact:true}).click();
  await panel.getByRole("button",{name:/11111111 · DECLINED/}).click();
  await expect(panel).toContainText("중단 기록 유지");
  expect(mutations.filter(x=>x==="/api/tasks")).toHaveLength(1);
  expect(mutations.some(x=>/confirm|orders|approval/.test(x))).toBe(false);
});
