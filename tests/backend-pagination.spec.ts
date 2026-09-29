import { test, expect } from "@playwright/test";
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const record = (id: string) => ({ id, ownerId: "fixture", status: "FAILED", mandate: { goal: "fixture", itemId: "item-1", maxTotal: "10.00", currency: "TEST_USDC", recipient: "merchant_good", expiresAt: "2099-01-01T00:00:00Z" }, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:01:00Z" });
test("history, event and evidence cursors; failure code; STOP survives reload", async ({ page }) => {
  const afters: string[] = []; const evidenceAfters: string[] = [];
  await page.route("**/api/floww/**", async route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    if (path.endsWith("/history")) return route.fulfill({ json: url.searchParams.has("before") ? { executions: [record(second)], nextCursor: second, hasMore: false } : { executions: [record(first)], nextCursor: first, hasMore: true } });
    if (path.endsWith("/api/executions")) return route.fulfill({ json: [record(first)] });
    if (path.endsWith("/events")) {
      const after = url.searchParams.get("after")!; afters.push(after);
      return route.fulfill({ json: { events: [{ seq: after === "0" ? 1 : 2, kind: after === "0" ? "MANDATE_CONFIRMED" : "INFERENCE_FAILED", payload: after === "0" ? {} : { code: "KILN_NOT_CONFIGURED" }, createdAt: "2026-09-29T00:00:00Z" }], nextCursor: after === "0" ? 1 : 2, hasMore: after === "0" } });
    }
    if (path.endsWith("/evidence.json")) {
      const after = url.searchParams.get("after")!; evidenceAfters.push(after);
      return route.fulfill({ json: { format: "floww-evidence-2", execution: record(first), events: { events: [], nextCursor: after === "0" ? 1 : 2, hasMore: after === "0" }, nextCursor: after === "0" ? 1 : 2, complete: false, pageComplete: true, paymentStatus: "NOT_ATTEMPTED" } });
    }
    if (path.endsWith(first)) return route.fulfill({ json: record(first) });
    return route.fulfill({ status: 404, json: { reasonCode: "FIXTURE_UNKNOWN" } });
  });
  await page.goto("/dashboard"); await page.locator("#backend-workspace > summary").click();
  const panel = page.locator("#backend-workspace");
  await panel.getByRole("button", { name: "실행 이력 조회", exact: true }).click();
  await panel.getByRole("button", { name: "이력 더 보기", exact: true }).click();
  await expect(panel.locator(".api-records li")).toHaveCount(2);
  await panel.locator(".api-records button").first().click();
  await expect(panel).toContainText("KILN_NOT_CONFIGURED · 서버의 Kiln 설정이 필요합니다.");
  expect(afters).toEqual(["0", "1"]);
  await panel.getByRole("button", { name: "evidence JSON 조회", exact: true }).click();
  await expect(panel).toContainText("서버 증거 2페이지");
  expect(evidenceAfters).toEqual(["0", "1"]);
  await panel.getByRole("button", { name: "에이전트 즉시 중단(STOP)", exact: true }).click();
  await page.reload(); await page.locator("#backend-workspace > summary").click();
  await expect(panel).toContainText("사용자 STOP");
  await panel.getByRole("button", { name: "최근 실행 조회", exact: true }).click();
  await panel.locator(".api-records button").first().click();
  await expect(panel.getByText("STOPPED · 로컬", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "테스트 실행 시작 (비용 발생 가능)", exact: true })).toBeDisabled();
});
