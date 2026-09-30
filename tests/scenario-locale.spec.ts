import { expect, test } from "@playwright/test";
import type { TaskView } from "../src/lib/api/task-types";

const owner = "0x1111111111111111111111111111111111111111";
const taskId = "11111111-2222-4333-8444-000000000036";
const asset = { chainId: 11155111, tokenAddress: "0x2222222222222222222222222222222222222222", tokenDecimals: 6 };

test("language setting keeps the authenticated scenario on the same Task at desktop and mobile widths", async ({ page }) => {
  const posts: string[] = [];
  let task: TaskView | null = null;
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json: route.request().url().endsWith("/config")
    ? { enabled: true, mode: "team-jwt", businessReady: true }
    : { identity: { namespace: "eip155", address: owner }, chainId: "11155111", expiresAt: new Date(Date.now() + 3600000).toISOString() } }));
  await page.route("**/api/tasks**", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST") posts.push(path);
    if (path === "/api/tasks" && request.method() === "POST") {
      const input = request.postDataJSON();
      task = { taskId, status: "AWAITING_APPROVAL", statusReasonCode: null, goal: input.goal,
        mandate: { mandateId: "66666666-7777-4888-8999-aaaaaaaaaaaa", version: 1, status: "DRAFT", itemId: input.itemId,
          maxAmountBaseUnits: input.maxAmountBaseUnits, consumedBaseUnits: "0", remainingBaseUnits: input.maxAmountBaseUnits,
          asset, expiresAt: input.expiresAt, budgetScope: "TASK_CUMULATIVE" }, attempts: [], updatedAt: new Date().toISOString(), completedAt: null };
      return route.fulfill({ json: task });
    }
    if (path.endsWith("/events")) return route.fulfill({ json: { events: [{ seq: 1, kind: "MANDATE_DRAFTED", state: "AWAITING_APPROVAL", reasonCode: null, actor: "user", createdAt: task!.updatedAt }], nextCursor: 1, hasMore: false } });
    if (path === `/api/tasks/${taskId}`) return route.fulfill({ json: task });
    if (path === "/api/tasks") return route.fulfill({ json: task ? [task] : [] });
    return route.fulfill({ status: 404, json: { reasonCode: "NOT_FOUND" } });
  });

  await page.goto("/pharmacy");
  await expect(page.locator("#scenario-progress")).toBeVisible();
  await page.getByRole("button", { name: /^01 허용된 구매/ }).click();
  await expect(page).toHaveURL(new RegExp(`/journey/${taskId}/mandate`));
  await expect(page.getByRole("navigation", { name: "구매 단계" })).toBeVisible();
  expect(posts).toEqual(["/api/tasks"]);

  await page.evaluate(() => { document.cookie = "floww-locale=en; Path=/; SameSite=Lax"; });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("navigation", { name: "Purchase steps" })).toContainText("Wallet approval");
  await expect(page.locator("#scenario-progress")).toContainText("Purchase goal");
  await expect(page.locator("#scenario-progress")).not.toContainText(/구매|지갑|약국|요청/);
  await page.getByRole("link", { name: /View this Task as a conversation/ }).click();
  await expect(page).toHaveURL(new RegExp(`/chat/${taskId}`));
  await expect(page).toHaveTitle(/Task conversation/);
  await expect(page.locator("#scenario-progress")).toBeVisible();
  await expect(page.locator(".chat-messages .user")).toContainText("Purchase request");
  await expect(page.locator(".chat-messages .user")).toContainText("Buy one pack of previously prescribed medicine");
  await page.getByRole("textbox", { name: "Display language request" }).fill("한국어로 바꿔줘");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("textbox", { name: "화면 언어 요청" })).toBeVisible();
  await expect(page.locator("#scenario-progress")).toContainText("구매 목적");
  await page.getByRole("textbox", { name: "화면 언어 요청" }).fill("English please");
  await page.getByRole("button", { name: "요청 보내기" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#scenario-progress")).toContainText("Purchase goal");
  await page.getByRole("textbox", { name: "Display language request" }).fill("What is the price?");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "This input changes display language only" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(new RegExp(`/chat/${taskId}`));
  expect(posts).toEqual(["/api/tasks"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.evaluate(() => { document.cookie = "floww-locale=ko; Path=/; SameSite=Lax"; });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page).toHaveTitle(/작업 대화/);
  await expect(page.locator(".chat-messages .user")).toContainText("구매 요청");
  expect(posts).toEqual(["/api/tasks"]);
});
