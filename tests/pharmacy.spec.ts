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
  await page.getByRole("button", { name: /예산 초과/ }).click();
  await expect(page.getByRole("heading", { name: "지갑 로그인 후 시작하세요" })).toBeVisible();
  expect(posts).toEqual([]);
});
