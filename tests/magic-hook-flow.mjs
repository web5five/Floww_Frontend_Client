// Actual auth hook, wallet provider, dialog and BFF joined by test-only React/SDK fixtures.
// The OTP, signature and backend response are synthetic; no product test global is installed.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import * as wallet from "../src/lib/auth/wallet.ts";
import * as magicSource from "../src/lib/auth/magic.ts";
import * as adapter from "../src/lib/auth/adapter.ts";
import { walletAuthProxy } from "../src/lib/auth/server.ts";

const ORIGIN = "http://localhost:3103";
const ADDRESS = "0x1111111111111111111111111111111111111111";
const CHAIN = "0xaa36a7";
const SIGNATURE = `0x${"11".repeat(65)}`;
const wait = () => new Promise(resolve => setTimeout(resolve, 10));
async function until(predicate) {
  for (let attempt = 0; attempt < 300; attempt++) { if (predicate()) return; await wait(); }
  assert.fail("Fixture state did not advance");
}
function hooks() {
  const cells = [];
  let cursor = 0, queued = [];
  const react = {
    createContext: () => ({ Provider: "context-provider" }),
    useContext: () => null,
    useRef(initial) { const at = cursor++; return cells[at] ??= { current: initial }; },
    useState(initial) {
      const at = cursor++;
      if (!(at in cells)) cells[at] = typeof initial === "function" ? initial() : initial;
      return [cells[at], value => { cells[at] = typeof value === "function" ? value(cells[at]) : value; }];
    },
    useEffect(effect, dependencies) {
      const at = cursor++, prior = cells[at];
      if (prior && dependencies?.length === prior.dependencies?.length && dependencies.every((value, index) => Object.is(value, prior.dependencies[index]))) return;
      queued.push(() => { prior?.cleanup?.(); const cleanup = effect(); cells[at] = { dependencies, cleanup }; });
    },
  };
  return {
    react,
    render(Component, props) { cursor = 0; queued = []; const tree = Component(props); const effects = queued; queued = []; for (const effect of effects) effect(); return tree; },
    dispose() { for (const cell of cells) cell?.cleanup?.(); },
  };
}
const jsx = (type, props) => {
  if (type === "dialog" && props.ref) {
    const node = props.ref.current ?? { open: false, showModal() { this.open = true; }, close() { this.open = false; this.onClose?.(); } };
    node.onClose = props.onClose;
    props.ref.current = node;
  }
  return { type, props };
};
function compile(file, mocks) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const result = { exports: {} };
  new Function("require", "module", "exports", output)(name => {
    assert.ok(name in mocks, `Unexpected test module dependency: ${name}`);
    return mocks[name];
  }, result, result.exports);
  return result.exports;
}
function nodes(tree, match, found = []) {
  if (Array.isArray(tree)) for (const item of tree) nodes(item, match, found);
  else if (tree && typeof tree === "object") { if (match(tree)) found.push(tree); nodes(tree.props?.children, match, found); }
  return found;
}
function words(tree) {
  if (Array.isArray(tree)) return tree.map(words).join(" ");
  if (tree && typeof tree === "object") return words(tree.props?.children);
  return typeof tree === "string" ? tree : "";
}

async function fixture() {
  const previous = Object.fromEntries(["FLOWW_WALLET_AUTH_ENABLED", "FLOWW_WALLET_AUTH_MODE", "FLOWW_API_BASE_URL", "FLOWW_WALLET_CHAIN_IDS", "FLOWW_SESSION_SECRET"].map(name => [name, process.env[name]]));
  const oldFetch = globalThis.fetch, oldWindow = globalThis.window, oldDocument = globalThis.document, oldLocation = globalThis.location;
  const browserWindow = new EventTarget(), browserDocument = new EventTarget();
  globalThis.window = browserWindow; globalThis.document = browserDocument;
  globalThis.location = { origin: ORIGIN, host: "localhost:3103", href: `${ORIGIN}/login` };
  const events = [], cookies = new Map();
  const challengeId = "a".repeat(48);
  const challengeExpiresAt = new Date(Date.now() + 290_000).toISOString();
  const sessionExpiresAt = new Date((Math.floor(Date.now() / 1000) + 1700) * 1000).toISOString();
  const message = `${ORIGIN} wants you to sign in with your Ethereum account:\n${ADDRESS}\n\nSign in to Floww\n\nURI: ${ORIGIN}\nVersion: 1\nChain ID: 11155111\nNonce: ${challengeId}\nIssued At: ${new Date().toISOString()}\nExpiration Time: ${challengeExpiresAt}`;
  const session = { identity: { namespace: "eip155", address: ADDRESS }, chainId: "11155111", expiresAt: sessionExpiresAt };
  const jwt = ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ sub: "fixture-owner", role: "USER", aud: ["client"], exp: Math.floor(Date.parse(sessionExpiresAt) / 1000) })).toString("base64url"), randomBytes(32).toString("base64url")].join(".");
  let releaseNonce;
  const nonceGate = new Promise(resolve => { releaseNonce = resolve; });
  const backend = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    events.push(`backend:${request.url}`);
    response.setHeader("Content-Type", "application/json");
    if (request.url.endsWith("/actuator/health")) response.end(JSON.stringify({ status: "UP" }));
    else if (request.url.endsWith("/nonce")) {
      assert.deepEqual(JSON.parse(body), { address: ADDRESS, chainId: 11155111 });
      await nonceGate;
      response.end(JSON.stringify({ nonce: challengeId, message, expiresAt: challengeExpiresAt }));
    } else if (request.url.endsWith("/verify")) {
      assert.deepEqual(JSON.parse(body), { message, signature: SIGNATURE });
      response.end(JSON.stringify({ accessToken: jwt, tokenType: "Bearer", expiresIn: 1800, user: { userId: "fixture-owner", role: "USER", wallets: [{ address: ADDRESS }] } }));
    }
    else { response.statusCode = 404; response.end("{}"); }
  });
  await new Promise(resolve => backend.listen(0, "127.0.0.1", resolve));
  process.env.FLOWW_WALLET_AUTH_ENABLED = "true";
  process.env.FLOWW_WALLET_AUTH_MODE = "team-jwt";
  process.env.FLOWW_WALLET_CHAIN_IDS = "11155111";
  process.env.FLOWW_SESSION_SECRET = randomBytes(32).toString("hex");
  process.env.FLOWW_API_BASE_URL = `http://127.0.0.1:${backend.address().port}`;
  globalThis.fetch = async (input, init = {}) => {
    if (typeof input !== "string" || !input.startsWith("/api/wallet-auth/")) return oldFetch(input, init);
    const action = input.split("/").at(-1);
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    if (method === "POST") { headers.set("Origin", ORIGIN); headers.set("Host", "localhost:3103"); }
    if (cookies.size) headers.set("Cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    events.push(`bff:${action}`);
    if (action === "verify") assert.deepEqual(JSON.parse(init.body), { challengeId, message, signature: SIGNATURE });
    const request = new Request(`${ORIGIN}${input}`, { method, headers, body: init.body });
    const response = await walletAuthProxy(request, action);
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator), value = pair.slice(separator + 1);
      if (/Max-Age=0(?:;|$)/i.test(setCookie)) cookies.delete(name);
      else cookies.set(name, value);
    }
    return response;
  };
  const providerHooks = hooks(), dialogHooks = hooks();
  let loggedIn = false, closed = false, heldMethod = "", releaseGuard, activeWallet;
  providerHooks.react.useContext = () => activeWallet;
  const sdk = {
    auth: { loginWithEmailOTP: async ({ email }) => { assert.equal(email, "person@example.test"); events.push("otp"); loggedIn = true; return "synthetic-did-is-not-identity"; } },
    user: { isLoggedIn: async () => loggedIn, logout: async () => { events.push("magic-logout"); loggedIn = false; }, onUserLoggedOut: () => {} },
    rpcProvider: {
      request: async ({ method, params }) => {
        events.push(method);
        if (method === heldMethod) { events.push(`held:${method}`); return new Promise(resolve => { releaseGuard = resolve; }); }
        if (method === "eth_accounts") return loggedIn ? [ADDRESS] : [];
        if (method === "eth_chainId") return CHAIN;
        if (method === "personal_sign") {
          assert.deepEqual(params, [`0x${Buffer.from(message, "utf8").toString("hex")}`, ADDRESS]);
          return SIGNATURE;
        }
        if (method === "eth_sendTransaction") return "unexpected-send";
        throw new Error(`Unexpected provider method ${method}`);
      },
      on: () => {}, removeListener: () => {},
    },
  };
  const magic = {
    ...magicSource,
    magicConfigured: () => true,
    createMagicAdapter: options => magicSource.createMagicAdapter({ ...options, publishableKey: "pk_synthetic_fixture", loadMagic: async () => ({ Magic: class { constructor() { return sdk; } } }) }),
  };
  const locale = { useLocale: () => ({ locale: "en", t: (_, en) => en }), translateWalletNotice: value => value };
  const runtime = { jsx, jsxs: jsx };
  const authHook = compile("../src/lib/auth/use-wallet-auth.ts", {
    react: providerHooks.react, "./adapter": adapter, "./wallet": wallet, "@/lib/i18n": locale,
  });
  const provider = compile("../src/components/wallet-provider.tsx", {
    react: providerHooks.react, "react/jsx-runtime": runtime, "@/lib/auth/wallet": wallet,
    "@/lib/auth/use-wallet-auth": authHook, "@/lib/auth/magic": magic,
  });
  const dialog = compile("../src/components/wallet-connect-dialog.tsx", {
    react: { ...dialogHooks.react, useContext: () => activeWallet }, "react/jsx-runtime": runtime,
    "./wallet-provider": provider, "@/lib/i18n": locale, "@/lib/auth/magic": magic,
    "./wallet-login.module.css": { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) },
  });
  function renderProvider() { activeWallet = providerHooks.render(provider.WalletProvider, { children: null }).props.value; return activeWallet; }
  function renderDialog() { return dialogHooks.render(dialog.WalletConnectDialog, { open: !closed, onClose: () => { closed = true; } }); }
  function submitMagic() {
    let tree = renderDialog();
    nodes(tree, node => node.type === "button" && words(node).includes("Magic"))[0].props.onClick();
    tree = renderDialog();
    nodes(tree, node => node.type === "input" && node.props.type === "email")[0].props.onChange({ target: { value: "person@example.test" } });
    tree = renderDialog();
    nodes(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  }
  async function beginLogin() {
    renderProvider();
    await until(() => renderProvider().auth.initialized);
    assert.equal(renderProvider().auth.enabled, true);
    submitMagic();
    await until(() => renderProvider().connection && events.includes("bff:challenge"));
    renderDialog();
    assert.equal(closed, true, "connected dialog closes before challenge finishes");
    renderDialog();
    assert.equal(events.includes("bff:logout"), false, "automatic close must not cancel login");
  }
  async function signIn() {
    await beginLogin();
    releaseNonce();
    await until(() => renderProvider().auth.session);
    assert.deepEqual(renderProvider().auth.session, session);
  }
  return {
    events, cookies, session, message, renderProvider, beginLogin, signIn, releaseChallenge: releaseNonce, isClosed: () => closed,
    hold(method) { heldMethod = method; },
    release(value) { heldMethod = ""; assert.ok(releaseGuard); releaseGuard(value); releaseGuard = null; },
    expire() { const now = Date.now; Date.now = () => Date.parse(sessionExpiresAt) + 1; try { browserWindow.dispatchEvent(new Event("focus")); } finally { Date.now = now; } },
    async close() {
      releaseNonce(); providerHooks.dispose(); dialogHooks.dispose();
      globalThis.fetch = oldFetch; globalThis.window = oldWindow; globalThis.document = oldDocument; globalThis.location = oldLocation;
      for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
      backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve));
    },
  };
}

test("actual auth hook composes Magic OTP provider, exact SIWE, BFF session and dialog auto-close", async () => {
  const flow = await fixture();
  try {
    await flow.signIn();
    assert.equal(flow.isClosed(), true);
    assert.equal(flow.events.filter(event => event === "personal_sign").length, 1);
    assert.deepEqual(flow.events.filter(event => event.startsWith("bff:")), ["bff:config", "bff:session", "bff:health", "bff:challenge", "bff:verify"]);
    assert.deepEqual(await adapter.walletAuthAdapter.getSession(), flow.session);
    assert.equal(flow.cookies.has("floww_wallet_session"), true);
    assert.equal(flow.renderProvider().auth.isCurrent(flow.renderProvider().auth.snapshot()), true);
  } finally { await flow.close(); }
});

test("actual auth hook and provider cancel a pending post-OTP challenge without signing", async () => {
  const flow = await fixture();
  try {
    await flow.beginLogin();
    flow.renderProvider().cancelMagic();
    flow.releaseChallenge();
    await until(() => flow.events.includes("bff:logout") && flow.events.includes("magic-logout"));
    assert.equal(flow.renderProvider().connection, null);
    assert.equal(flow.renderProvider().auth.session, null);
    assert.equal(flow.events.includes("personal_sign"), false);
    assert.equal(flow.events.includes("bff:verify"), false);
    assert.equal(flow.cookies.has("floww_wallet_session"), false);
  } finally { await flow.close(); }
});

for (const guard of ["eth_accounts", "eth_chainId"]) test(`requestForOwner blocks ${guard} resumed after authority ends`, async () => {
  const flow = await fixture();
  try {
    await flow.signIn();
    flow.hold(guard);
    const operation = guard === "eth_accounts" ? "eth_sendTransaction" : "eth_signTypedData_v4";
    const request = flow.renderProvider().requestForOwner(ADDRESS, operation, [{ to: ADDRESS }]);
    await until(() => flow.events.includes(`held:${guard}`));
    if (guard === "eth_accounts") await flow.renderProvider().auth.logout();
    else flow.expire();
    flow.release(guard === "eth_accounts" ? [ADDRESS] : CHAIN);
    await assert.rejects(request, /지갑 계정·Sepolia 네트워크 변경 또는 STOP/);
    assert.equal(flow.renderProvider().auth.session, null);
    assert.equal(flow.events.includes(operation), false);
    assert.equal(flow.events.filter(event => event === "personal_sign").length, 1);
  } finally { await flow.close(); }
});
