import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
test("team JWT adapter protects cookies and gates unavailable business authentication", () => {
  expect(execFileSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "tests/wallet-team-proxy.mjs"], { encoding: "utf8", timeout: 30000 })).toContain("passed");
});
test("wallet auth proxy isolates credentials and refuses shared dev identity", () => {
  expect(execFileSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "tests/wallet-auth-proxy.mjs"], { encoding: "utf8", timeout: 30000 })).toContain("checks passed");
});
async function setup(page: Page, mode: "ok" | "reject" | "wrong-domain" | "invalid" = "ok", team = false) {
  await page.addInitScript(({ reject }) => {
    const address = "0x1111111111111111111111111111111111111111";
    const methods: string[] = [];
    const listeners: Record<string, (() => void)[]> = {};
    Object.assign(window, { authFixture: { methods, change: () => (listeners.accountsChanged ?? []).forEach(fn => fn()), emit: (name: string) => [...(listeners[name] ?? [])].forEach(fn => fn()) } });
    const provider = { request: async ({ method }: { method: string }) => { methods.push(method); if (method === "eth_chainId") return "0x1"; if (method === "personal_sign") { if (reject) throw { code: 4001 }; return "0x" + "11".repeat(65); } return [address]; }, on: (name: string, fn: () => void) => { (listeners[name] ??= []).push(fn); }, removeListener: (name: string, fn: () => void) => { listeners[name] = (listeners[name] ?? []).filter(f => f !== fn); } };
    window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "auth-fixture", name: "Auth Fixture" }, provider } })));
  }, { reject: mode === "reject" });
  let verifies = 0;
  let signedIn = false;
  await page.route("**/api/wallet-auth/*", async route => {
    const action = route.request().url().split("/").at(-1);
    const session = { identity: { namespace: "eip155", address: "0x1111111111111111111111111111111111111111" }, chainId: "1", expiresAt: new Date(Date.now() + 300000).toISOString() };
    if (action === "config") return route.fulfill({ json: { enabled: true, mode: team ? "team-jwt" : "local-session" } });
    if (action === "session") return route.fulfill({ json: signedIn ? session : null });
    if (action === "logout") { signedIn = false; return route.fulfill({ json: { revoked: true } }); }
    if (action === "challenge") {
      const origin = new URL(route.request().url());
      return route.fulfill({ json: { id: "a".repeat(64), expiresAt: session.expiresAt, message: `${mode === "wrong-domain" ? "evil.test" : origin.host} wants you to sign in with your Ethereum account:\n${session.identity.address}\n\nSign in to Floww. This does not authorize spending.\n\nURI: ${origin.origin}/login\nVersion: 1\nChain ID: 1\nNonce: abcdef123456\nIssued At: ${new Date().toISOString()}\nExpiration Time: ${session.expiresAt}` } });
    }
    verifies++; await new Promise(r => setTimeout(r, 100));
    if (mode === "invalid") return route.fulfill({ status: 401, json: { reasonCode: "UNAUTHORIZED" } });
    signedIn = true; return route.fulfill({ json: session });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
  await page.getByRole("button", { name: /Auth Fixture.*이 브라우저에서 감지됨/ }).click();
  await page.getByRole("button", { name: "Auth Fixture 연결", exact: true }).click();
  return () => verifies;
}
test("wallet login verifies once, restores session, and logout clears authentication", async ({ page }) => {
  const count = await setup(page);
  await page.getByRole("button", { name: "로그인 메시지 서명", exact: true }).evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toBeVisible();
  expect(count()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "지갑 계정", exact: true }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByRole("button", { name: "지갑 연결", exact: true })).toBeVisible();
});
for (const mode of ["reject", "wrong-domain", "invalid"] as const) test(`wallet ${mode} never authenticates`, async ({ page }) => {
  const count = await setup(page, mode);
  await page.getByRole("button", { name: "로그인 메시지 서명", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toHaveCount(0);
  expect(count()).toBe(mode === "invalid" ? 1 : 0);
});
test("wallet account change revokes authenticated state", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "로그인 메시지 서명", exact: true }).click();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { authFixture: { change(): void } }).authFixture.change());
  await expect(page.getByRole("button", { name: "지갑 연결", exact: true })).toBeVisible();
});
for (const event of ["chainChanged", "disconnect"]) test(`wallet ${event} clears old identity safely`, async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "로그인 메시지 서명", exact: true }).click();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toBeVisible();
  await page.evaluate(name => (window as unknown as { authFixture: { emit(name: string): void } }).authFixture.emit(name), event);
  await expect(page.getByRole("button", { name: "지갑 연결", exact: true })).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "지갑 선택", exact: true })).toBeEnabled();
});
test("login server failure supports explicit retry without dropping wallet connection", async ({ page }) => {
  await setup(page);
  let fail = true;
  await page.route("**/api/wallet-auth/verify", route => {
    if (fail) { fail = false; return route.fulfill({ status: 502, json: { reasonCode: "AUTH_UPSTREAM_UNAVAILABLE" } }); }
    return route.fallback();
  });
  const login = page.getByRole("button", { name: "로그인 메시지 서명", exact: true });
  await login.click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText("Auth Fixture 연결됨", { exact: true })).toBeVisible();
  await login.click();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toBeVisible();
});
test("session expiration removes authenticated identity", async ({ page }) => {
  await page.clock.install();
  await setup(page);
  await page.getByRole("button", { name: "로그인 메시지 서명", exact: true }).click();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toBeVisible();
  await page.clock.fastForward(310000);
  await page.getByRole("button", { name: "로그인 계속하기", exact: true }).click();
  await expect(page.getByText("로그인 세션이 만료되었습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toHaveCount(0);
});
test("failed session lookup never invents login and restores after server recovery", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "로그인 메시지 서명", exact: true }).click();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toBeVisible();
  let fail = true;
  await page.route("**/api/wallet-auth/session", route => fail ? route.fulfill({ status: 502, json: { reasonCode: "AUTH_UPSTREAM_UNAVAILABLE" } }) : route.fallback());
  await page.reload();
  await page.goto("/login");
  await expect(page.getByText("서버 로그인 상태를 확인하지 못했습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toHaveCount(0);
  fail = false;
  await page.reload();
  await expect(page.getByRole("button", { name: "지갑 계정", exact: true })).toBeVisible();
});
test("unsupported chain is explained before requesting a signature", async ({ page }) => {
  await setup(page);
  await page.route("**/api/wallet-auth/config", route => route.fulfill({ json: { enabled: true, chainIds: ["11155111"] } }));
  await page.reload();
  await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
  await page.getByRole("button", { name: /Auth Fixture.*이 브라우저에서 감지됨/ }).click();
  await page.getByRole("button", { name: "Auth Fixture 연결", exact: true }).click();
  await expect(page.getByText("지원하는 로그인 네트워크", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인 메시지 서명", exact: true })).toBeDisabled();
});

test('team server wakeup failure keeps wallet connected and never signs or retries automatically', async ({ page }) => {
  const count = await setup(page, 'ok', true);
  let probes = 0;
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  await page.route('**/api/wallet-auth/health', async route => {
    probes++; await gate;
    await route.fulfill({status:503,json:{reasonCode:'AUTH_UPSTREAM_UNAVAILABLE'}});
  });
  const button=page.locator('button[aria-describedby="wallet-auth-help"]');
  await button.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect.poll(() => probes).toBe(1);
  await expect(button).toBeDisabled();
  release();
  await expect(page.locator('main [role="alert"]')).toBeVisible();
  await expect(button).toBeEnabled();
  expect(count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as {authFixture:{methods:string[]}}).authFixture.methods.includes('personal_sign'))).toBe(false);
  expect(probes).toBe(1);
  await button.click();
  await expect.poll(() => probes).toBe(2);
  expect(count()).toBe(0);
});
