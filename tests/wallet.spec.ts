import { test, expect } from "@playwright/test";
test("wallet absent: no fabricated login or signing", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("감지된 지갑이 없습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인 서명 (API 연결 전)", exact: true })).toBeDisabled();
  await expect(page.getByText("백엔드 연결 설정 필요", { exact: false })).toBeVisible();
});
test("wallet discovery, rejection, connection, change and disconnect never authenticate", async ({ page }, info) => {
  await page.addInitScript(() => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const state = { calls: [] as string[], reject: true, address: "0x1111111111111111111111111111111111111111", emit: (name: string, value: unknown) => { for (const fn of [...(listeners[name] ?? [])]) fn(value); } };
    const provider = {
      request: async ({ method }: { method: string }) => {
        state.calls.push(method);
        if (method === "eth_requestAccounts" && state.reject) { state.reject = false; throw { code: 4001 }; }
        if (method === "eth_chainId") return "0x1";
        if (["eth_requestAccounts", "eth_accounts"].includes(method)) return [state.address];
        throw new Error("Signing/transaction request forbidden in fixture");
      },
      on: (name: string, fn: (...args: unknown[]) => void) => { (listeners[name] ??= []).push(fn); },
      removeListener: (name: string, fn: (...args: unknown[]) => void) => { listeners[name] = (listeners[name] ?? []).filter(f => f !== fn); },
    };
    Object.assign(window, { walletFixture: state });
    window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "fixture-wallet", name: "Fixture Wallet" }, provider } })));
  });
  await page.goto("/login");
  const connect = page.getByRole("button", { name: "Fixture Wallet 연결", exact: true });
  await connect.click();
  await expect(page.getByText("지갑 연결을 거절했습니다.", { exact: false })).toBeVisible();
  await connect.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect(page.getByText("연결됨 · 미인증", { exact: true })).toBeVisible();
  await expect(page.getByText("로그인 전 · 서버 검증 없음", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인 서명 (API 연결 전)", exact: true })).toBeDisabled();
  const calls = await page.evaluate(() => (window as unknown as { walletFixture: { calls: string[] } }).walletFixture.calls);
  expect(calls).toEqual(["eth_requestAccounts", "eth_requestAccounts", "eth_chainId", "eth_accounts"]);
  await page.screenshot({ path: `artifacts/wallet-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByRole("link", { name: "지갑 연결됨", exact: true }).click();
  await expect(page.getByText("연결됨 · 미인증", { exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { walletFixture: { emit: (name: string, value: unknown) => void } }).walletFixture.emit("accountsChanged", []));
  await expect(page.getByText("지갑 계정 또는 네트워크가 변경되었습니다.", { exact: false })).toBeVisible();
  await connect.click();
  await page.getByRole("button", { name: "지갑 연결 해제", exact: true }).click();
  await expect(page.getByText("이 앱의 지갑 연결을 해제했습니다.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(connect).toBeEnabled();
});
test("presentation text is bold and readable without horizontal overflow", async ({ page }) => {
  for (const path of ["/", "/dashboard", "/login"]) {
    await page.goto(path);
    if (path === "/dashboard") await expect(page.getByText("Challenge B demo", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const invalid = await page.locator("main").evaluate(main => [...main.querySelectorAll("p,small,time,label,dt,dd,button,h1,h2,h3")].filter(el => el.getClientRects().length && el.textContent?.trim()).filter(el => { const s = getComputedStyle(el); return parseFloat(s.fontSize) < 14 || parseInt(s.fontWeight) < 700; }).map(el => el.tagName + ":" + el.textContent?.slice(0, 30)));
    expect(invalid).toEqual([]);
  }
});
