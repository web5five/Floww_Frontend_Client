import { expect, test } from "@playwright/test";

test("language choice persists through reload and keeps the shell in one language", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("radio", { name: "영어" }).check();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Purchase scenarios" })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/[가-힣]/);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
  expect(await page.locator("body").innerText()).not.toMatch(/[가-힣]/);
  const response = await page.request.get("/settings");
  expect(await response.text()).toMatch(/<html[^>]*lang="en"/);

  await page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Buy with clarity/ })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/[가-힣]/);
  await page.getByRole("button", { name: "Switch to Korean" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("navigation", { name: "메인 메뉴" }).getByRole("link", { name: "구매 시나리오" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: /명확하게/ })).toBeVisible();
});

test("English wallet login keeps the product return path and translated dialog", async ({ page }) => {
  await page.context().addCookies([{ name: "floww-locale", value: "en", url: "http://127.0.0.1:3001" }]);
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json: { enabled: false } }));
  await page.goto("/pharmacy?scenario=recipient");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/pharmacy?scenario=recipient");
  await expect(page.getByRole("heading", { name: "Sign in with your wallet." })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.locator("body").innerText()).not.toMatch(/[가-힣]/);
  await page.getByRole("button", { name: "Choose wallet" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Choose how to sign in" })).toBeVisible();
  expect(await dialog.innerText()).not.toMatch(/[가-힣]/);
});

test("locale change retranslates a pending wallet error and preserves the wallet connection", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { calls: [] as string[], reject: true };
    const provider = {
      request: async ({ method }: { method: string }) => {
        state.calls.push(method);
        if (method === "eth_requestAccounts" && state.reject) { state.reject = false; throw { code: 4001 }; }
        if (method === "eth_chainId") return "0x1";
        if (method === "eth_requestAccounts" || method === "eth_accounts") return ["0x1111111111111111111111111111111111111111"];
        throw new Error("Unexpected wallet method");
      },
      on: () => {}, removeListener: () => {},
    };
    Object.assign(window, { walletFixture: state });
    window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "locale-fixture", name: "MetaMask" }, provider } })));
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
  await page.getByRole("button", { name: /MetaMask.*이 브라우저에서 감지됨/ }).click();
  await page.getByRole("tab", { name: "모바일" }).click();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } }));
  await page.getByRole("button", { name: "이 페이지 주소 복사" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("주소를 복사할 수 없습니다.");
  await page.getByRole("button", { name: "영어로 변경" }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Could not copy the address.");
  await page.getByRole("tab", { name: "Desktop" }).click();
  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await expect(page.getByRole("region", { name: "Wallet sign-in" }).getByRole("status")).toContainText("Wallet connection rejected.");
  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await expect(page.getByText("MetaMask connected", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/Floww — Buy with clarity/);
  await page.getByRole("button", { name: "Switch to Korean" }).click();
  await expect(page.getByText("MetaMask 연결됨", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/Floww — 내 조건으로/);
  const calls = await page.evaluate(() => (window as unknown as { walletFixture: { calls: string[] } }).walletFixture.calls);
  expect(calls).not.toContain("personal_sign");
});

test("settings, navigation, and wallet control fit narrow mobile viewports", async ({ page, isMobile }) => {
  if (!isMobile) test.skip();
  await page.context().addCookies([{ name: "floww-locale", value: "en", url: "http://127.0.0.1:3001" }]);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/settings", "/", "/login?returnTo=%2Fpharmacy"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}px`).toBe(true);
    }
    await page.goto("/");
    await page.screenshot({ path: `artifacts/f036a-overview-en-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Switch to Korean" }).click();
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Korean Overview at ${width}px`).toBe(true);
    await page.screenshot({ path: `artifacts/f036a-overview-ko-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "영어로 변경" }).click();
  }
});
