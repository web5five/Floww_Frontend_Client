import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("server proxy contract and credential isolation", () => {
  const output = execFileSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "tests/proxy-harness.mjs"], { encoding: "utf8", timeout: 30_000 });
  expect(output).toContain("checks passed");
});
test("missing server configuration fails visibly, never fabricates success", async ({ page, request }) => {
  const response = await request.get("/api/floww/actuator/health");
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ reasonCode: "BACKEND_NOT_CONFIGURED" });
  await page.goto("/dashboard");
  await page.locator("#backend-workspace > summary").click();
  await page.getByRole("button", { name: "연결 상태 확인" }).click();
  await expect(page.locator("#backend-workspace [role=alert]")).toContainText("백엔드 연결 설정 필요");
});
const id = "11111111-1111-4111-8111-111111111111";
const mandate = { goal: "Fixture test", itemId: "item-1", recipient: "merchant_good", maxTotal: "119.12345678", currency: "TEST_USDC", expiresAt: "2099-01-01T00:00:00Z" };
const execution = (status = "CREATED") => ({ id, ownerId: "fixture", status, mandate, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:01:00Z" });
const ready = { httpContractVersion: "ai-draft-http.v1", status: "READY_FOR_REVIEW", draft: { schemaVersion: "ai-draft.v1", objective: "Nike shoes", itemScope: "black EU45", providerCriteria: "Nike only", maximumTotalCost: { amount: "120.00000001", asset: "USDC", includesAllUserPaidFees: true }, deadline: "2099-01-01T00:00:00Z", fulfillmentCriterion: "Delivered" }, issues: [], evidence: { modelId: "qwen3-32b", modelEvidenceMode: "fixture" }, error: null };
async function open(page: Page) { await page.goto("/dashboard"); await page.locator("#backend-workspace > summary").click(); }
test("draft clarification preserves conversation, prevents duplicates, and never delegates", async ({ page }, info) => {
  const bodies: { conversation: { role: string; content: string }[] }[] = [];
  await page.route("**/api/floww/api/ai/drafts", async route => {
    bodies.push(route.request().postDataJSON());
    await new Promise(r => setTimeout(r, 250));
    await route.fulfill({ json: bodies.length === 1 ? { ...ready, status: "NEEDS_CLARIFICATION", draft: null, issues: [{ code: "FEES", field: "maximumTotalCost", question: "수수료를 포함할까요?" }] } : ready });
  });
  await open(page);
  const form = page.locator("#backend-workspace .purchase-form").first();
  await form.locator('[name="deadline"]').fill("2099-01-01T12:00");
  await form.locator('[name="allowed_merchants"]').fill("Nike");
  await form.getByRole("button").evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect(page.getByText("수수료를 포함할까요?", { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(1);
  await page.getByLabel("추가 답변").fill("네, 모든 수수료 포함입니다.");
  await page.getByRole("button", { name: "답변 추가 및 초안 재요청 (비용 발생 가능)" }).click();
  await expect(page.getByText("Mandate 검토 대기", { exact: true })).toBeVisible();
  expect(bodies[1].conversation).toHaveLength(3);
  expect(bodies[1].conversation[0]).toEqual(bodies[0].conversation[0]);
  expect(bodies[1].conversation[1].role).toBe("assistant");
  await expect(page.locator("#backend-workspace")).toContainText("120.00000001");
  await page.locator("#backend-workspace").getByRole("button", { name: "Mandate 확인 및 위임 승인", exact: true }).click();
  await expect(page.getByText("초안 확인만 했습니다. 실제 위임 승인·결제는 연결 전입니다.")).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#backend-workspace").screenshot({ path: `artifacts/api-draft-${info.project.name}.png` });
});
for (const scenario of ["REVIEWED", "BUDGET_EXCEEDED", "RECIPIENT_NOT_ALLOWED", "STOPPED"] as const) {
  test(`execution ${scenario}: polling, evidence, STOP and terminal state separation`, async ({ page }, info) => {
    let status = "CREATED"; let runs = 0; let creates = 0; const afters: string[] = [];
    await page.route("**/api/floww/**", async route => {
      const url = new URL(route.request().url()); const path = url.pathname;
      if (path.endsWith("/api/executions") && route.request().method() === "POST") {
        creates++; expect(route.request().headers()["idempotency-key"]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
        expect(route.request().postDataJSON().mandate.maxTotal).toBe("119.12345678");
        return route.fulfill({ json: execution() });
      }
      if (path.endsWith("/run")) { runs++; status = scenario === "REVIEWED" ? "REVIEWED" : scenario === "STOPPED" ? "RUNNING" : "REJECTED"; return route.fulfill({ json: execution(status) }); }
      if (path.endsWith("/events")) { afters.push(url.searchParams.get("after")!); const blocked = status === "REJECTED"; return route.fulfill({ json: { events: [{ seq: 1, kind: blocked ? "POLICY_REJECTED" : "MANDATE_CONFIRMED", payload: blocked ? { reasonCode: scenario } : {}, createdAt: "2026-09-29T00:00:00Z" }], nextCursor: 1, hasMore: false } }); }
      if (path.endsWith("/evidence.json")) return route.fulfill({ json: { format: "floww-evidence-2", execution: execution(status), events: { events: [], nextCursor: 1, hasMore: false }, nextCursor: 1, complete: true, pageComplete: true, paymentStatus: "NOT_AVAILABLE" } });
      if (path.endsWith("/api/executions")) return route.fulfill({ json: [execution(status)] });
      if (path.endsWith(id)) return route.fulfill({ json: execution(status) });
      return route.fulfill({ status: 404, json: { reasonCode: "FIXTURE_UNKNOWN" } });
    });
    await open(page);
    await page.locator(".api-test > summary").click();
    const form = page.locator(".api-test form");
    for (const [key, value] of Object.entries({ goal: "Fixture test", itemId: "item-1", recipient: "merchant_good", maxTotal: "119.12345678", expiresAt: "2099-01-01T12:00" })) await form.locator(`[name="${key}"]`).fill(value);
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "테스트 실행 생성" }).evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
    await expect(page.getByText("Your approval · API 테스트")).toBeVisible();
    expect(creates).toBe(1);
    await page.getByRole("button", { name: "테스트 실행 시작 (비용 발생 가능)" }).click();
    expect(runs).toBe(1);
    const panel = page.locator("#backend-workspace");
    if (scenario === "STOPPED") {
      await panel.getByRole("button", { name: "에이전트 즉시 중단(STOP)", exact: true }).click();
      await expect(panel.getByText("STOPPED · 로컬", { exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: "테스트 실행 시작 (비용 발생 가능)" })).toBeDisabled();
      await expect(panel).toContainText("사용자 STOP");
      await panel.getByRole("button", { name: "서버 상태 다시 조회" }).click();
      await expect(panel.getByText("STOPPED · 로컬", { exact: true })).toBeVisible();
    } else {
      await expect(panel).toContainText(scenario === "REVIEWED" ? "REVIEWED · 테스트 실행 검토 완료" : "REJECTED · 정책 차단");
      if (scenario !== "REVIEWED") await expect(panel).toContainText(scenario);
      await panel.getByRole("button", { name: "evidence JSON 조회", exact: true }).click();
      const download = page.waitForEvent("download");
      await panel.getByRole("button", { name: "evidence JSON 다운로드" }).click();
      expect((await download).suggestedFilename()).toBe(`floww-evidence-${id}.json`);
      expect(afters.length).toBeGreaterThan(0);
    }
    expect(runs).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.screenshot({ path: `artifacts/api-${scenario}-${info.project.name}.png` });
  });
}
