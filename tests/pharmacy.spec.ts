import { test, expect } from "@playwright/test";
import { formatFusdc, pharmacyQuotes, quoteSubtotal, exceedsPreviewBudget } from "../src/lib/pharmacy-preview";

test("pharmacy amounts preserve six decimals and large integers", () => {
  expect(formatFusdc("9007199254740993000001")).toBe("9007199254740993.000001 fUSDC");
  expect(pharmacyQuotes.map(quoteSubtotal)).toEqual(["43000000", "47000000", "63000000"]);
  expect(pharmacyQuotes.map(exceedsPreviewBudget)).toEqual([false, false, true]);
  expect(() => formatFusdc("1.5")).toThrow();
});
test("pharmacy review invalidates selection and never grants authority", async ({ page }, info) => {
  const mutations: string[] = [];
  page.on("request", r => { if (r.method() === "POST") mutations.push(r.url()); });
  await page.goto("/pharmacy");
  await page.getByRole("button", { name: "약국 A 검토", exact: true }).click();
  const review = page.locator("#pharmacy-review");
  await review.getByRole("button", { name: "데모 검토 확인", exact: true }).click();
  await expect(review.getByText("데모 검토 확인됨", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "약국 B 검토", exact: true }).click();
  await expect(review.getByRole("button", { name: "데모 검토 확인", exact: true })).toBeEnabled();
  await expect(page.getByText(/이전 검토 확인 해제/)).toBeVisible();
  await expect(review.getByRole("button", { name: "Mandate 확인 및 위임 승인 · 연결 전", exact: true })).toBeDisabled();
  await expect(page.getByText("미실행 · 트랜잭션 없음", { exact: true })).toBeVisible();
  await expect(page.getByText("미검증 · 약국 주문/배송 증거 없음", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/pharmacy-${info.project.name}.png`, fullPage: true });
  expect(mutations).toEqual([]);
});
test("pharmacy budget block and local STOP cannot become payment", async ({ page }) => {
  await page.goto("/pharmacy");
  await page.getByRole("button", { name: "약국 C 검토", exact: true }).click();
  const review = page.locator("#pharmacy-review");
  await expect(review.getByText("BLOCKED · 수수료를 더하기 전부터 예산 초과")).toBeVisible();
  await expect(review.getByRole("button", { name: "데모 검토 확인", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "로컬 검토 중단(STOP)", exact: true }).click();
  await expect(review.getByText("STOPPED · 로컬", { exact: true })).toBeVisible();
  for (const label of ["약국 A 검토", "약국 B 검토", "약국 C 검토"]) await expect(page.getByRole("button", { name: label, exact: true })).toBeDisabled();
  await expect(review.getByRole("button", { name: "로컬 검토 중단(STOP)", exact: true })).toBeDisabled();
});
