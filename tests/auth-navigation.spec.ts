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

test("Overview introduces the process but keeps executable scenarios behind login", async ({ page }) => {
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json:{enabled:false} }));
  await page.goto("/");
  await expect(page.getByRole("heading",{name:/Buy with/})).toBeVisible();
  await expect(page.getByRole("heading",{name:"한 번의 요청, 눈에 보이는 과정."})).toBeVisible();
  await expect(page.locator("a[href*='scenario=']")).toHaveCount(0);
  await expect(page.locator(".wordmark img").first()).toHaveAttribute("src","/brand/floww-mark.svg");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
