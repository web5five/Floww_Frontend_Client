import { test, expect } from "@playwright/test";

const forbidden = /\bmock\b|prototype|MVP|version\s*1|프로토타입|목데이터|버전\s*1|AI 생성 이미지/i;

test("overview navigation opens the three real scenario entries", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Buy with clarity/ })).toBeVisible();
  await expect(page.locator("#scenarios .scenario-card")).toHaveCount(3);
  await expect(page.locator(".site-header .header-login")).toBeVisible();
  for (const id of ["permitted", "over-budget", "recipient"]) {
    await page.locator(`#scenarios a[href="/pharmacy?scenario=${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/pharmacy\\?scenario=${id}$`));
    await expect(page.locator(".scenario-intent")).toContainText("시작 후 24시간");
    await expect(page.locator(".scenario-grid button[aria-pressed=true]")).toHaveCount(1);
    await page.getByRole("link", { name: "Overview" }).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("primary pages keep development labels out of visible copy", async ({ page }) => {
  for (const path of ["/", "/pharmacy", "/dashboard"]) {
    await page.goto(path);
    const visible = await page.locator("body").innerText();
    expect(visible).not.toMatch(forbidden);
  }
});
