import { test, expect } from "@playwright/test";

const startNormal = async (page: import("@playwright/test").Page) => {
  await page.goto("/dashboard");
  await page.getByRole("radio", { name: /정상 시나리오/ }).check();
  await page.getByRole("button", { name: "선택한 데모 실행", exact: true }).click();
  await expect(page.locator("#purchase-approval .section-heading .tag")).toHaveText("사용자 승인 대기");
};

test("approval is local-only, guarded, and activity survives navigation", async ({ page }, testInfo) => {
  const unexpected: string[] = [];
  const errors: string[] = [];
  page.on("request", req => {
    if (req.method() !== "GET" || !["127.0.0.1", "localhost"].includes(new URL(req.url()).hostname) || req.url().includes("/api/v1/")) unexpected.push(req.url());
  });
  page.on("pageerror", err => errors.push(err.message));
  await startNormal(page);
  const approval = page.locator("#purchase-approval");
  const history = page.getByRole("list", { name: "구매 활동 기록" });
  await expect(history.getByRole("listitem")).toHaveCount(3);
  await expect(history.getByRole("listitem").nth(0)).toContainText("구매 조건 생성");
  await expect(history.getByRole("listitem").nth(1)).toContainText("AI 데모 판단");
  await expect(history.getByRole("listitem").nth(2)).toContainText("예산·판매처 정책 검사");
  await expect(approval).toContainText("108.00 USDC");
  await expect(approval).toContainText("12.00 USDC");
  await expect(page.getByRole("button", { name: "선택한 데모 실행" })).toBeDisabled();
  await page.getByRole("button", { name: "Mandate 확인 및 위임 승인", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(approval.locator(".section-heading .tag")).toHaveText("APPROVED · 승인됨");
  await expect(history.getByRole("listitem")).toHaveCount(4);
  await expect(history.getByRole("listitem").last()).toContainText("사용자 최종 승인");
  for (const name of ["Mandate 확인 및 위임 승인", "거절", "전체 중단"]) await expect(approval.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.locator("#purchase-evidence")).toContainText("승인 완료 · 테스트넷 실행 대기");
  await expect(page.locator("#purchase-evidence")).toContainText("실제 영수증 미수신");
  const dates = await history.locator("time").evaluateAll(nodes => nodes.map(node => Date.parse(node.getAttribute("datetime")!)));
  expect(dates).toEqual([...dates].sort((a, b) => a - b));
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("heading", { name: "잠시만 기다려 주세요" })).toBeVisible();
  await expect(page.locator(".demo-banner")).toContainText("데모 데이터 갱신 완료");
  await expect(history.getByRole("listitem")).toHaveCount(4);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(history.getByRole("listitem")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `artifacts/purchase-dashboard-${testInfo.project.name}.png`, fullPage: true });
  await page.reload();
  await expect(page.getByRole("heading", { name: "아직 구매 활동이 없어요" })).toBeVisible();
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("rejection, cancellation and rerun keep distinct chronological records", async ({ page }) => {
  await startNormal(page);
  const approval = page.locator("#purchase-approval");
  const history = page.getByRole("list", { name: "구매 활동 기록" });
  await page.getByRole("button", { name: "거절", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(approval.locator(".section-heading .tag")).toHaveText("REJECTED · 거절됨");
  await expect(history.getByRole("listitem")).toHaveCount(4);
  await approval.getByRole("link", { name: "다른 데모 다시 실행" }).click();
  await page.getByRole("button", { name: "선택한 데모 실행" }).click();
  await expect(approval.locator(".section-heading .tag")).toHaveText("사용자 승인 대기");
  await page.getByRole("button", { name: "전체 중단", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(approval.locator(".section-heading .tag")).toHaveText("전체 중단됨");
  await expect(history.getByRole("listitem")).toHaveCount(8);
  await expect(history).toContainText("사용자 거절");
  await expect(history.getByRole("listitem").last()).toContainText("전체 중단");
  await expect(approval.getByRole("button")).toHaveCount(0);
});

test("budget and merchant scenarios block with explicit reasons", async ({ page }, testInfo) => {
  await page.goto("/dashboard");
  const approval = page.locator("#purchase-approval");
  const history = page.getByRole("list", { name: "구매 활동 기록" });
  for (const scenario of [
    { radio: /예산 초과/, title: "예산 초과 차단", reason: "122.00 USDC" },
    { radio: /미승인 판매처/, title: "미승인 판매처 차단", reason: "미승인 데모 마켓" },
  ]) {
    await page.getByRole("radio", { name: scenario.radio }).check();
    await page.getByRole("button", { name: "선택한 데모 실행" }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect(approval.locator(".section-heading .tag")).toHaveText("BLOCKED");
    await expect(history.getByRole("listitem").last()).toContainText(scenario.title);
    await expect(history.getByRole("listitem").last()).toContainText(scenario.reason);
    await expect(history.getByRole("listitem").last().locator(".tag")).toHaveText("BLOCKED");
    await expect(approval.getByRole("button", { name: "Mandate 확인 및 위임 승인", exact: true })).toHaveCount(0);
  }
  await expect(history.getByRole("listitem")).toHaveCount(8);
  await expect(page.locator("#purchase-evidence")).toContainText("결제 상태");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `artifacts/purchase-blocked-${testInfo.project.name}.png`, fullPage: true });
});

test("editable purchase conditions validate deadline and use actual form values", async ({ page }, testInfo) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "구매 조건 입력 보기" }).click();
  const form = page.locator("#mandate-form");
  await expect(form).toHaveAttribute("open", "");
  await form.getByLabel("상품 또는 구매 목적").fill("아침 조깅용 신발 구매");
  await form.getByLabel("브랜드", { exact: true }).fill("Nike");
  await form.getByLabel("카테고리", { exact: true }).fill("러닝화");
  await form.getByLabel("색상", { exact: true }).fill("검정");
  await form.getByLabel("사이즈 (EU)", { exact: true }).fill("45");
  await form.getByLabel("최대 예산 (USDC)", { exact: true }).fill("110");
  const localValue = (offset: number) => {
    const d = new Date(Date.now() + offset);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  await form.getByLabel("구매 기한 (현재 기기 시간)", { exact: true }).fill(localValue(-86400000));
  await form.getByRole("button", { name: "구매 조건 생성 및 데모 판단" }).click();
  await expect(form.getByRole("alert")).toContainText("현재 시각 이후");
  await form.getByLabel("구매 기한 (현재 기기 시간)", { exact: true }).fill(localValue(86400000));
  await form.getByLabel("허용 판매처", { exact: true }).fill("Nike 데모 스토어, 추가 데모 스토어");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await form.screenshot({ path: "artifacts/purchase-form-" + testInfo.project.name + ".png" });
  await form.getByRole("button", { name: "구매 조건 생성 및 데모 판단" }).click();
  await expect(page.locator("#purchase-mandate")).toContainText("아침 조깅용 신발 구매");
  await expect(page.locator("#purchase-mandate")).toContainText("110.00 USDC");
  await expect(page.locator("#purchase-mandate")).toContainText("추가 데모 스토어");
  await expect(page.locator("#purchase-approval")).toContainText("2.00 USDC");
  await page.getByRole("button", { name: "전체 중단", exact: true }).click();
  await form.locator("summary").click();
  await form.getByLabel("색상", { exact: true }).fill("흰색");
  await form.getByRole("button", { name: "구매 조건 생성 및 데모 판단" }).click();
  await expect(page.locator("#purchase-approval .section-heading .tag")).toHaveText("BLOCKED");
  await expect(page.getByRole("list", { name: "구매 활동 기록" }).getByRole("listitem").last()).toContainText("상품 조건 불일치 차단");
});

test("landing buttons, all feature anchors and responsive layout", async ({ page }, testInfo) => {
  // This test visits every landing CTA and anchor (over a dozen navigations).
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Buy with clarity. Stay in control." })).toBeVisible();
  await expect(page.getByText("Smarter Crypto Trading", { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `artifacts/purchase-landing-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("link", { name: "작동 방식 보기" }).click();
  await expect(page.locator("#how-it-works")).toBeInViewport();
  const links = page.getByRole("link", { name: "구매 데모 시작", exact: true });
  for (let i = 0; i < await links.count(); i++) {
    if (!await links.nth(i).isVisible()) continue;
    await links.nth(i).click();
    await expect(page).toHaveURL(/dashboard$/);
    await page.getByRole("link", { name: "Overview", exact: true }).click();
  }
  for (const name of ["구매 데모 살펴보기", "구매 대시보드 살펴보기"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(/dashboard$/);
    await page.getByRole("link", { name: "Overview", exact: true }).click();
  }
  for (const [name, id] of [
    ["구매 조건 설정 보기", "mandate-form"],
    ["AI 상품 조건 분석 보기", "ai-insight"],
    ["정책 및 예산 검사 보기", "purchase-budget"],
    ["사용자 최종 승인 보기", "purchase-approval"],
    ["테스트넷 결제 및 증거 확인 보기", "purchase-evidence"],
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`dashboard#${id}$`));
    await expect(page.locator(`#${id}`)).toBeInViewport();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
  }
});

test("loading error recovery still uses the local mock route", async ({ page, request }) => {
  let fail = true;
  await page.route("**/api/dashboard", async route => {
    if (fail) await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    else await route.continue();
  });
  await page.goto("/dashboard");
  await expect(page.getByRole("alert").filter({ hasText: "화면을 불러오지 못했어요" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Purchase budget" })).toBeVisible();
  const response = await request.get("/api/dashboard");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect((await response.json()).data).toMatchObject({ source: "mock", connection: "not-connected" });
});

test("STOP immediately locks pending and approved tasks and records an audit event", async ({ page }, testInfo) => {
  const mutations: string[] = [];
  page.on("request", request => { if (request.method() !== "GET") mutations.push(request.url()); });
  await startNormal(page);
  const approval = page.locator("#purchase-approval");
  const stop = approval.getByRole("button", { name: "에이전트 즉시 중단(STOP)", exact: true });
  const history = page.getByRole("list", { name: "구매 활동 기록" });
  await expect(approval.getByRole("button", { name: "Mandate 확인 및 위임 승인", exact: true })).toBeVisible();
  await expect(approval.getByRole("button", { name: "거절", exact: true })).toBeVisible();
  await expect(stop).toHaveCSS("background-color", "rgb(201, 42, 61)");
  const before = Date.now();
  await stop.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(approval.locator(".section-heading .tag")).toHaveText("STOPPED");
  await expect(stop).toBeDisabled();
  await expect(approval.getByRole("button", { name: "Mandate 확인 및 위임 승인", exact: true })).toBeDisabled();
  await expect(approval.getByRole("button", { name: "거절", exact: true })).toBeDisabled();
  await expect(history.getByRole("listitem")).toHaveCount(4);
  const event = history.getByRole("listitem").last();
  await expect(event).toContainText("에이전트 즉시 중단(STOP)");
  await expect(event).toContainText("demo_task_001");
  await expect(event).toContainText("중단 사유: 사용자가");
  await expect(event.locator(".tag")).toHaveText("STOPPED");
  const stoppedAt = Date.parse((await event.locator("time").getAttribute("datetime"))!);
  expect(stoppedAt).toBeGreaterThanOrEqual(before);
  expect(stoppedAt).toBeLessThanOrEqual(Date.now());
  await expect(page.locator("#purchase-evidence")).toContainText("결제·블록체인 실행 금지");
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.locator(".demo-banner")).toContainText("갱신 완료");
  await expect(approval.locator(".section-heading .tag")).toHaveText("STOPPED");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(approval.locator(".section-heading .tag")).toHaveText("STOPPED");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await approval.screenshot({ path: "artifacts/stop-" + testInfo.project.name + ".png" });

  // A new demo has a distinct ID; an already-approved task can still be stopped.
  await page.getByRole("button", { name: "선택한 데모 실행" }).click();
  await page.getByRole("button", { name: "Mandate 확인 및 위임 승인", exact: true }).click();
  await expect(stop).toBeEnabled();
  await stop.click();
  await expect(approval.locator(".section-heading .tag")).toHaveText("STOPPED");
  await expect(history.getByRole("listitem")).toHaveCount(9);
  await expect(history.getByRole("listitem").last()).toContainText("demo_task_002");
  expect(mutations).toEqual([]);
});

test("state-specific evidence and complete approval and rejection audit", async ({ page }, testInfo) => {
  await page.goto("/dashboard");
  const approval = page.locator("#purchase-approval");
  for (const name of ["Mandate 확인 및 위임 승인", "거절", "에이전트 즉시 중단(STOP)"]) await expect(approval.getByRole("button", { name, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "선택한 데모 실행" }).click();
  const before = Date.now();
  await approval.getByRole("button", { name: "Mandate 확인 및 위임 승인", exact: true }).click();
  const history = page.getByRole("list", { name: "구매 활동 기록" });
  const event = history.getByRole("listitem").last();
  await expect(event).toContainText("사용자 최종 승인");
  await expect(event).toContainText("demo_task_001");
  await expect(event).toContainText("판매처: Nike 데모 스토어");
  await expect(event).toContainText("총액: 108.00 USDC");
  await expect(event).toContainText("승인 주체: 현재 사용자 (데모 · 미인증)");
  const approvedAt = Date.parse((await event.locator("time").getAttribute("datetime"))!);
  expect(approvedAt).toBeGreaterThanOrEqual(before);
  expect(approvedAt).toBeLessThanOrEqual(Date.now());
  await expect(page.locator("#purchase-evidence")).toContainText("승인 완료 · 테스트넷 실행 대기");
  await page.locator("#purchase-evidence").screenshot({ path: "artifacts/approved-evidence-" + testInfo.project.name + ".png" });
  await page.getByRole("button", { name: "선택한 데모 실행" }).click();
  await approval.getByRole("button", { name: "거절", exact: true }).click();
  await expect(approval.locator(".section-heading .tag")).toHaveText("REJECTED · 거절됨");
  await expect(event).toContainText("demo_task_002");
  await expect(event).toContainText("사유: 사용자가 구매 제안을 거절했습니다.");
  await expect(event.locator("time")).toBeVisible();
  await expect(page.locator("#purchase-evidence")).toContainText("REJECTED · 결제·블록체인 실행 금지");
  await expect(page.locator("#purchase-evidence")).not.toContainText("승인 완료");
  for (const option of [/예산 초과/, /미승인 판매처/]) {
    await page.getByRole("radio", { name: option }).check();
    await page.getByRole("button", { name: "선택한 데모 실행" }).click();
    await expect(approval.locator(".section-heading .tag")).toHaveText("BLOCKED");
    for (const name of ["Mandate 확인 및 위임 승인", "거절", "에이전트 즉시 중단(STOP)"]) await expect(approval.getByRole("button", { name, exact: true })).toHaveCount(0);
    await expect(page.locator("#purchase-evidence")).toContainText("BLOCKED · 결제·블록체인 실행 금지");
    await expect(event.locator(".tag")).toHaveText("BLOCKED");
  }
});

test("deadline expiry automatically removes approval controls and blocks execution", async ({ page }) => {
  await page.clock.install();
  await startNormal(page);
  await page.clock.fastForward(7 * 24 * 60 * 60 * 1000 + 1);
  const approval = page.locator("#purchase-approval");
  await expect(approval.locator(".section-heading .tag")).toHaveText("BLOCKED");
  for (const name of ["Mandate 확인 및 위임 승인", "거절", "에이전트 즉시 중단(STOP)"]) await expect(approval.getByRole("button", { name, exact: true })).toHaveCount(0);
  const history = page.getByRole("list", { name: "구매 활동 기록" });
  await expect(history.getByRole("listitem").last()).toContainText("구매 기한 초과 차단");
  await expect(history.getByRole("listitem")).toHaveCount(4);
  await expect(page.locator("#purchase-evidence")).toContainText("BLOCKED · 결제·블록체인 실행 금지");
});
