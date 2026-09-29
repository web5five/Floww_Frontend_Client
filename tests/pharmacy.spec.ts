import { test, expect } from "@playwright/test";
import { formatFusdc } from "../src/lib/pharmacy-preview";

test("server amounts retain exact six decimal places", () => {
  expect(formatFusdc("9007199254740993000001")).toBe("9007199254740993.000001 fUSDC");
  expect(() => formatFusdc("1.5")).toThrow();
});

test("a scenario cannot create a Task before authentication", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname.startsWith("/api/tasks")) posts.push(request.url()); });
  await page.goto("/pharmacy");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("heading", { name: "지갑으로 로그인하세요." })).toBeVisible();
  await expect(page.locator(".scenario-grid button")).toHaveCount(0);
  expect(posts).toEqual([]);
});
