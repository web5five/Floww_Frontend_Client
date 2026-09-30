import { test, expect } from "@playwright/test";

const forbidden = /\bmock\b|prototype|MVP|version\s*1|프로토타입|목데이터|버전\s*1|AI 생성 이미지/i;

test("judge console previews three outcomes and leads through login before execution", async ({ page }, testInfo) => {
  let signedIn = false;
  const session = {identity:{namespace:"eip155",address:"0x1111111111111111111111111111111111111111"},chainId:"11155111",expiresAt:new Date(Date.now()+3600000).toISOString()};
  await page.route("**/api/wallet-auth/*", route => route.fulfill({json:route.request().url().endsWith("config") ? {enabled:true,mode:"team-jwt"} : signedIn ? session : null}));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /명확하게 구매하고/ })).toBeVisible();
  await expect(page.locator(".site-header .header-login")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    const logo = await page.getByRole("link", {name:"Floww 홈",exact:true}).boundingBox();
    const wallet = await page.locator(".site-header .header-login").boundingBox();
    expect(logo && wallet && Math.abs((logo.y + logo.height / 2) - (wallet.y + wallet.height / 2)) < 4).toBe(true);
  }
  await page.screenshot({path:`artifacts/overview-${testInfo.project.name}.png`,fullPage:true});
  await page.getByRole("link", {name:"로그인하고 시작",exact:true}).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.locator(".scenario-grid button")).toHaveCount(0);
  signedIn = true;
  await page.goto("/pharmacy");
  await expect(page.locator(".scenario-grid button")).toHaveCount(3);
  await expect(page.locator(".scenario-intent")).toContainText("시작 후 24시간");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/scenario-choices-${testInfo.project.name}.png`,fullPage:true});
});

test("primary pages keep development labels out of visible copy", async ({ page }) => {
  for (const path of ["/", "/pharmacy", "/dashboard"]) {
    await page.goto(path);
    const visible = await page.locator("body").innerText();
    expect(visible).not.toMatch(forbidden);
  }
});
