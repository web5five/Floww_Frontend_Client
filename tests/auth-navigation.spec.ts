import { test, expect } from "@playwright/test";
import { loginReturnTo } from "../src/lib/auth/return-to";
const taskId = "11111111-2222-4333-8444-555555555555";

test("login return allows only local product routes", () => {
  expect(loginReturnTo(`/chat/${taskId}?scenario=recipient`)).toBe(`/chat/${taskId}?scenario=recipient`);
  expect(loginReturnTo(`/journey/${taskId}/approval`)).toBe(`/journey/${taskId}/approval`);
  for (const url of ["//evil.example/voice", "https://evil.example/voice", "/\\evil.example/voice", "/api/tasks", "/login?returnTo=/voice", "javascript:alert(1)"]) expect(loginReturnTo(url)).toBe("/pharmacy");
});

test("signed-out scenario chat and voice routes require login without Task mutations", async ({ page }) => {
  const posts: string[] = [];
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json: route.request().url().endsWith("config") ? {enabled:true,mode:"team-jwt",businessReady:true} : null }));
  await page.route("**/api/tasks**", route => { posts.push(route.request().method()); return route.fulfill({status:401,json:{reasonCode:"UNAUTHORIZED"}}); });
  for (const path of ["/pharmacy?scenario=recipient", `/chat/${taskId}?scenario=recipient`, "/voice?scenario=allowed", `/journey/${taskId}/approval`]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp("/login\\?returnTo="));
    const current = new URL(page.url());
    expect(current.searchParams.get("returnTo")).toBe(path);
    await expect(page.getByRole("heading",{name:"지갑으로 로그인하세요."})).toBeVisible();
    await expect(page.locator(".scenario-card")).toHaveCount(0);
  }
  expect(posts).toEqual([]);
});

test("Overview presents the judge demo console but keeps execution behind login", async ({ page }) => {
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json:{enabled:false} }));
  await page.goto("/");
  await expect(page.getByRole("heading",{name:/세 번 누르면/})).toBeVisible();
  await expect(page.getByRole("button",{name:/정상 구매/})).toBeVisible();
  await expect(page.getByRole("button",{name:/예산 초과 차단/})).toBeVisible();
  await expect(page.getByRole("button",{name:/수취인 위반 차단/})).toBeVisible();
  await expect(page.locator("a[href*='scenario=']")).toHaveCount(0);
  await expect(page.locator(".wordmark img").first()).toHaveAttribute("src","/brand/floww-mark.svg");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("returning to a suspended expired session hides the scenario and requires login", async ({ page }) => {
  const start = Date.now();
  await page.clock.install({time:start});
  const session = {identity:{namespace:"eip155",address:"0x1111111111111111111111111111111111111111"},chainId:"11155111",expiresAt:new Date(start + 3600000).toISOString()};
  const calls: string[] = [];
  await page.route("**/api/wallet-auth/*", route => route.fulfill({json:route.request().url().endsWith("config") ? {enabled:true,mode:"team-jwt"} : session}));
  await page.route("**/api/tasks**", route => {calls.push(route.request().method()); return route.fulfill({status:401,json:{reasonCode:"UNAUTHORIZED"}});});
  await page.goto("/pharmacy");
  await expect(page.getByRole("region",{name:"구매 시나리오 선택"})).toBeVisible();
  await page.clock.setSystemTime(start + 3600001);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("region",{name:"구매 시나리오 선택"})).toHaveCount(0);
  expect(calls).toEqual([]);
});
