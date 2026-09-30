import { test, expect } from "@playwright/test";
test("wallet absent: no fabricated login or signing", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
  await page.getByRole("button", { name: /MetaMask.*확장 프로그램/ }).click();
  await expect(page.getByText("MetaMask가 감지되지 않았습니다.", { exact: false })).toBeVisible();
  await page.getByRole("tab", { name: "모바일" }).click();
  await expect(page.getByRole("button", { name: "이 페이지 주소 복사" })).toBeVisible();
  await page.getByRole("button", { name: "← 로그인 방법" }).click();
  await page.getByRole("button", { name: /Magic.*현재 로그인 설정 없음/ }).click();
  await expect(page.getByText("Magic 로그인이 아직 설정되지 않았습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "이메일로 계속" })).toBeDisabled();
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
    window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "fixture-wallet", name: "MetaMask" }, provider } })));
  });
  await page.goto("/login");
  const openWallet = async () => {
    await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
    await page.getByRole("button", { name: /MetaMask.*이 브라우저에서 감지됨/ }).click();
  };
  await openWallet();
  const connect = page.getByRole("button", { name: "MetaMask 연결", exact: true });
  await connect.click();
  await expect(page.getByRole("dialog").getByText("지갑 연결을 거절했습니다.", { exact: false })).toBeVisible();
  await connect.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect(page.getByText("MetaMask 연결됨", { exact: true })).toBeVisible();
  await page.getByText("연결 및 로그인 상태 자세히 보기").click();
  await expect(page.getByText("로그인 전", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인 메시지 서명", exact: true })).toBeDisabled();
  const calls = await page.evaluate(() => (window as unknown as { walletFixture: { calls: string[] } }).walletFixture.calls);
  expect(calls).toEqual(["eth_requestAccounts", "eth_requestAccounts", "eth_chainId", "eth_accounts"]);
  await page.screenshot({ path: `artifacts/wallet-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "내 작업", exact: true }).click();
  await page.getByRole("button", { name: "로그인 계속하기", exact: true }).click();
  await expect(page.getByText("MetaMask 연결됨", { exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { walletFixture: { emit: (name: string, value: unknown) => void } }).walletFixture.emit("accountsChanged", []));
  await expect(page.getByText("지갑 계정 또는 네트워크가 변경되었습니다.", { exact: false }).first()).toBeVisible();
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
    window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "pending-wallet", name: "MetaMask" }, provider } })));
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
  await page.getByRole("button", { name: /MetaMask.*이 브라우저에서 감지됨/ }).click();
  await page.getByRole("button", { name: "MetaMask 연결", exact: true }).click();
  await page.getByRole("button", { name: "닫기", exact: true }).first().click();
  await page.evaluate(() => (window as unknown as { pendingWallet: { release(): void } }).pendingWallet.release());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("MetaMask 연결됨", { exact: true })).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { pendingWallet: { calls: string[] } }).pendingWallet.calls);
  expect(calls).not.toContain("personal_sign");
});
test("wallet login is readable without horizontal overflow", async ({ page }) => {
  await page.goto("/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const invalid = await page.getByRole("main").evaluate(main => [...main.querySelectorAll("p,small,time,label,dt,dd,button,h1,h2,h3")].filter(el => el.getClientRects().length && el.textContent?.trim()).filter(el => { const s = getComputedStyle(el); return parseFloat(s.fontSize) < 14 || parseInt(s.fontWeight) < 700; }).map(el => el.tagName + ":" + el.textContent?.slice(0, 30)));
  expect(invalid).toEqual([]);
});

test("English Magic configuration gate stays usable on a narrow screen", async ({ page }) => {
  await page.goto("/login?returnTo=%2Fdashboard");
  await page.getByRole("button", { name: "영어로 변경" }).click();
  await page.getByRole("button", { name: "Choose wallet", exact: true }).click();
  await page.getByRole("button", { name: /Magic.*Sign-in is not configured/ }).click();
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText("Magic sign-in is not configured yet.");
  await expect(page.getByRole("dialog")).not.toContainText(/[가-힣]/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Korean and English wallet choices stay readable with Magic unconfigured", async ({ page, isMobile }) => {
  for (const width of isMobile ? [390, 320] : [1440]) {
    await page.setViewportSize({ width, height: isMobile ? 844 : 1000 });
    for (const locale of ["ko", "en"] as const) {
      await page.goto("/login");
      const current = await page.locator("html").getAttribute("lang");
      if (current !== locale) await page.getByRole("button", { name: locale === "en" ? "영어로 변경" : "Switch to Korean" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const progressStep = page.getByText(locale === "en" ? "1 · Connect" : "1 · 연결", { exact: true });
      await expect(progressStep).toBeVisible();
      expect(await progressStep.evaluate(element => element.scrollWidth <= element.clientWidth), `${locale} progress at ${width}px`).toBe(true);
      await expect(page.getByRole("banner").getByRole("button", { name: locale === "en" ? "Connect wallet" : "지갑 연결" })).toBeVisible();
      await page.screenshot({ path: `artifacts/f037-login-progress-${locale}-${width}.png`, fullPage: true });
      await page.getByRole("button", { name: locale === "en" ? "Choose wallet" : "지갑 선택" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: locale === "en" ? "Choose how to sign in" : "로그인 방법을 선택하세요" })).toBeVisible();
      await page.screenshot({ path: `artifacts/f037-wallet-choices-${locale}-${width}.png`, fullPage: true });
      await dialog.getByRole("button", { name: locale === "en" ? /Magic.*Sign-in is not configured/ : /Magic.*현재 로그인 설정 없음/ }).click();
      await expect(dialog.getByRole("button", { name: locale === "en" ? "Continue with email" : "이메일로 계속" })).toBeDisabled();
      if (locale === "en") expect(await dialog.innerText()).not.toMatch(/[가-힣]/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${locale} at ${width}px`).toBe(true);
      await page.screenshot({ path: `artifacts/f037-wallet-magic-unconfigured-${locale}-${width}.png`, fullPage: true });
    }
  }
});
