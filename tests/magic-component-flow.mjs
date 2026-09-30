// Test-only TypeScript module mocks exercise the actual WalletProvider and dialog handlers.
// The product bundle has no fixture global or authentication bypass.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import * as wallet from "../src/lib/auth/wallet.ts";
import * as realMagic from "../src/lib/auth/magic.ts";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) { if (predicate()) return; await tick(); }
  assert.fail("Fixture state did not advance");
}
function hooks(runEffects = false) {
  const cells = [];
  let cursor = 0, effects = [];
  const react = {
    createContext: () => ({ Provider: "context-provider" }),
    useContext: () => null,
    useRef(initial) { const at = cursor++; return cells[at] ??= { current: initial }; },
    useState(initial) {
      const at = cursor++;
      if (!(at in cells)) cells[at] = typeof initial === "function" ? initial() : initial;
      return [cells[at], value => { cells[at] = typeof value === "function" ? value(cells[at]) : value; }];
    },
    useEffect(callback) { if (runEffects) effects.push(callback); },
  };
  return { react, render(Component, props) { cursor = 0; effects = []; const tree = Component(props); for (const effect of effects) effect(); return tree; } };
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
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", output)((name) => {
    assert.ok(name in mocks, `Unexpected test module dependency: ${name}`);
    return mocks[name];
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
function nodes(tree, match, found = []) {
  if (Array.isArray(tree)) for (const item of tree) nodes(item, match, found);
  else if (tree && typeof tree === "object") {
    if (match(tree)) found.push(tree);
    nodes(tree.props?.children, match, found);
  }
  return found;
}
function words(tree) {
  if (Array.isArray(tree)) return tree.map(words).join(" ");
  if (tree && typeof tree === "object") return words(tree.props?.children);
  return typeof tree === "string" ? tree : "";
}

function fixture() {
  const providerHooks = hooks();
  const dialogHooks = hooks(true);
  const events = [];
  let loggedIn = false, closed = false, activeWallet = null, releaseChallenge;
  providerHooks.react.useContext = () => activeWallet;
  const challenge = new Promise(resolve => { releaseChallenge = resolve; });
  const auth = {
    session: null, generation: 0, isPending: () => false,
    async logout() { events.push("bff-logout"); this.generation++; this.session = null; return true; },
    async login(connection, provider) {
      events.push("bff-challenge");
      const run = this.generation;
      await challenge;
      if (run !== this.generation) return;
      assert.equal(connection.address, ADDRESS);
      assert.equal(connection.chainId, "0xaa36a7");
      assert.deepEqual(await provider.request({ method: "eth_accounts" }), [ADDRESS]);
      await provider.request({ method: "personal_sign", params: ["0x66697874757265", ADDRESS] });
      if (run !== this.generation) return;
      this.session = { identity: { namespace: "eip155", address: ADDRESS }, chainId: "11155111", expiresAt: new Date(Date.now() + 60000).toISOString() };
      events.push("bff-verified");
    },
    snapshot: () => ({ session: null }), isCurrent: () => false,
  };
  const sdk = {
    auth: { loginWithEmailOTP: async () => { events.push("otp"); loggedIn = true; } },
    user: { isLoggedIn: async () => loggedIn, logout: async () => { events.push("magic-logout"); loggedIn = false; }, onUserLoggedOut: () => {} },
    rpcProvider: {
      request: async ({ method }) => {
        events.push(method);
        if (method === "eth_accounts") return loggedIn ? [ADDRESS] : [];
        if (method === "eth_chainId") return "0xaa36a7";
        if (method === "personal_sign") return `0x${"11".repeat(65)}`;
        throw new Error(`Unexpected provider method: ${method}`);
      },
      on: () => {}, removeListener: () => {},
    },
  };
  const magic = {
    ...realMagic,
    magicConfigured: () => true,
    createMagicAdapter: options => realMagic.createMagicAdapter({ ...options, publishableKey: "pk_synthetic_fixture", loadMagic: async () => ({ Magic: class { constructor() { return sdk; } } }) }),
  };
  const runtime = { jsx, jsxs: jsx };
  const provider = compile("../src/components/wallet-provider.tsx", {
    react: providerHooks.react, "react/jsx-runtime": runtime,
    "@/lib/auth/wallet": wallet, "@/lib/auth/use-wallet-auth": { useWalletAuth: () => auth }, "@/lib/auth/magic": magic,
  });
  const dialog = compile("../src/components/wallet-connect-dialog.tsx", {
    react: { ...dialogHooks.react, useContext: () => activeWallet }, "react/jsx-runtime": runtime,
    "./wallet-provider": provider, "@/lib/i18n": { useLocale: () => ({ locale: "en", t: (_, en) => en }), translateWalletNotice: value => value },
    "@/lib/auth/magic": magic, "./wallet-login.module.css": { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) },
  });
  function renderProvider() { activeWallet = providerHooks.render(provider.WalletProvider, { children: null }).props.value; return activeWallet; }
  function renderDialog() { return dialogHooks.render(dialog.WalletConnectDialog, { open: !closed, onClose: () => { closed = true; }, onLoginStarted: () => { events.push("login-intent"); } }); }
  function submitMagic() {
    let tree = renderDialog();
    const magicChoice = nodes(tree, node => node.type === "button" && words(node).includes("Magic"))[0];
    assert.ok(magicChoice);
    magicChoice.props.onClick();
    tree = renderDialog();
    const email = nodes(tree, node => node.type === "input" && node.props.type === "email")[0];
    assert.ok(email);
    email.props.onChange({ target: { value: "person@example.test" } });
    tree = renderDialog();
    const form = nodes(tree, node => node.type === "form")[0];
    assert.ok(form);
    form.props.onSubmit({ preventDefault() {} });
  }
  return { auth, events, renderProvider, renderDialog, submitMagic, releaseChallenge: () => releaseChallenge(), isClosed: () => closed, isLoggedIn: () => loggedIn };
}

test("configured Magic connectMagic keeps the challenge alive when its dialog auto-closes", async () => {
  const flow = fixture();
  flow.renderProvider();
  flow.submitMagic();
  await until(() => !!flow.renderProvider().connection && flow.events.includes("bff-challenge"));
  flow.renderDialog(); // Actual connection effect closes the presentation without calling cancelMagic.
  assert.equal(flow.isClosed(), true);
  flow.renderDialog(); // Native close event runs after the parent hides it.
  assert.equal(flow.events.includes("bff-logout"), false);
  flow.releaseChallenge();
  await until(() => !!flow.auth.session);
  assert.equal(flow.events.filter(event => event === "personal_sign").length, 1);
  assert.equal(flow.events.includes("bff-verified"), true);
  assert.equal(flow.isLoggedIn(), true);
});

test("user cancellation after OTP clears the provider while the challenge is pending", async () => {
  const flow = fixture();
  flow.renderProvider();
  flow.submitMagic();
  await until(() => !!flow.renderProvider().connection && flow.events.includes("bff-challenge"));
  flow.renderProvider().cancelMagic();
  await until(() => !flow.isLoggedIn());
  assert.equal(flow.renderProvider().connection, null);
  flow.releaseChallenge();
  await tick();
  assert.equal(flow.auth.session, null);
  assert.equal(flow.events.includes("personal_sign"), false);
  assert.equal(flow.events.includes("bff-logout"), true);
  assert.equal(flow.events.includes("magic-logout"), true);
});
