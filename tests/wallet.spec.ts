import { test, expect } from "@playwright/test";
test("wallet absent: no fabricated login or signing", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
  await page.getByRole("button", { name: /MetaMask.*설치 여부 확인/ }).click();
  await expect(page.getByText("MetaMask 지갑이 감지되지 않았습니다.", { exact: false })).toBeVisible();
  await page.getByRole("tab", { name: "모바일" }).click();
  await expect(page.getByRole("button", { name: "이 페이지 주소 복사" })).toBeVisible();
  await page.getByRole("button", { name: "← 지갑 목록" }).click();
  await page.getByRole("button", { name: /WalletConnect.*현재 연결 설정 없음/ }).click();
  await expect(page.getByText("현재 WalletConnect 연결 설정이 없어 QR 페어링을 제공할 수 없습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("dialog").locator("img, canvas, svg[aria-label*=QR]")).toHaveCount(0);
  await page.getByRole("button", { name: "닫기", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "지갑 선택", exact: true })).toBeVisible();
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
  const openWallet = async () => {
    await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
    await page.getByRole("button", { name: /Fixture Wallet.*이 브라우저에서 감지됨/ }).click();
  };
  await openWallet();
  const connect = page.getByRole("button", { name: "Fixture Wallet 연결", exact: true });
  await connect.click();
  await expect(page.getByRole("dialog").getByText("지갑 연결을 거절했습니다.", { exact: false })).toBeVisible();
  await connect.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect(page.getByText("Fixture Wallet 연결됨", { exact: true })).toBeVisible();
  await page.getByText("연결 및 로그인 상태 자세히 보기").click();
  await expect(page.getByText("로그인 전", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인 메시지 서명", exact: true })).toBeDisabled();
  const calls = await page.evaluate(() => (window as unknown as { walletFixture: { calls: string[] } }).walletFixture.calls);
  expect(calls).toEqual(["eth_requestAccounts", "eth_requestAccounts", "eth_chainId", "eth_accounts"]);
  await page.screenshot({ path: `artifacts/wallet-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByRole("link", { name: "지갑 연결됨", exact: true }).click();
  await expect(page.getByText("Fixture Wallet 연결됨", { exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { walletFixture: { emit: (name: string, value: unknown) => void } }).walletFixture.emit("accountsChanged", []));
  await expect(page.getByText("지갑 계정 또는 네트워크가 변경되었습니다.", { exact: false })).toBeVisible();
  await openWallet();
  await connect.click();
  await page.getByRole("button", { name: "지갑 연결 해제", exact: true }).click();
  await expect(page.getByText("이 앱의 지갑 연결을 해제했습니다.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "지갑 선택", exact: true })).toBeEnabled();
});
test("closing a pending connection never opens login or signs automatically", async ({ page }) => {
  await page.addInitScript(() => {
    const address = "0x1111111111111111111111111111111111111111";
    let release: (() => void) | undefined;
    const calls: string[] = [];
    Object.assign(window, { pendingWallet: { calls, release: () => release?.() } });
    const provider = {
      request: async ({ method }: { method: string }) => {
        calls.push(method);
        if (method === "eth_requestAccounts") await new Promise<void>(resolve => { release = resolve; });
        if (method === "eth_chainId") return "0x1";
        return [address];
      },
      on: () => {}, removeListener: () => {},
    };
    window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "pending-wallet", name: "Pending Wallet" }, provider } })));
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
  await page.getByRole("button", { name: /Pending Wallet.*이 브라우저에서 감지됨/ }).click();
  await page.getByRole("button", { name: "Pending Wallet 연결", exact: true }).click();
  await page.getByRole("button", { name: "닫기", exact: true }).first().click();
  await page.evaluate(() => (window as unknown as { pendingWallet: { release(): void } }).pendingWallet.release());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Pending Wallet 연결됨", { exact: true })).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { pendingWallet: { calls: string[] } }).pendingWallet.calls);
  expect(calls).not.toContain("personal_sign");
});
test("wallet login is readable without horizontal overflow", async ({ page }) => {
  await page.goto("/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const invalid = await page.getByRole("main").evaluate(main => [...main.querySelectorAll("p,small,time,label,dt,dd,button,h1,h2,h3")].filter(el => el.getClientRects().length && el.textContent?.trim()).filter(el => { const s = getComputedStyle(el); return parseFloat(s.fontSize) < 14 || parseInt(s.fontWeight) < 700; }).map(el => el.tagName + ":" + el.textContent?.slice(0, 30)));
  expect(invalid).toEqual([]);
});
