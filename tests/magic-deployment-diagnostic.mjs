// Fixture-only actual TaskExecution handler: no wallet, RPC or server write is made.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { WalletRequestFailure } from "../src/lib/auth/wallet.ts";

const owner = `0x${"1".repeat(40)}`, taskId = "11111111-2222-4333-8444-555555555555";
const data = "0x1234";
const task = { taskId, status: "AWAITING_APPROVAL", mandate: { mandateId: taskId, version: 1 }, attempts: [{ policy: { decision: "ALLOW" }, mandateId: taskId, mandateVersion: 1, attemptId: taskId }] };
const account = { taskId, ownerAddress: owner, state: "PREPARED", deploymentData: data, amountBaseUnits: "1", expiresAt: new Date(Date.now() + 3600000).toISOString() };
const jsx = (type, props) => ({ type, props });
function compile(file, mocks) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", output)(name => { assert.ok(name in mocks, `Unexpected dependency ${name}`); return mocks[name]; }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
function walk(tree, match, found = []) {
  if (Array.isArray(tree)) for (const child of tree) walk(child, match, found);
  else if (tree && typeof tree === "object") { if (match(tree)) found.push(tree); walk(tree.props?.children, match, found); }
  return found;
}
function words(tree) {
  if (Array.isArray(tree)) return tree.map(words).join(" ");
  if (tree && typeof tree === "object") return words(tree.props?.children);
  return typeof tree === "string" || typeof tree === "number" ? String(tree) : "";
}
function fixture(failure) {
  const oldStorage = globalThis.sessionStorage;
  const stored = new Map();
  globalThis.sessionStorage = { setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key), getItem: key => stored.get(key) ?? null };
  const state = [], refs = []; let stateCursor = 0, refCursor = 0, sends = 0;
  const react = {
    useState(initial) { const at = stateCursor++; if (!(at in state)) state[at] = initial; return [state[at], value => { state[at] = typeof value === "function" ? value(state[at]) : value; }]; },
    useRef(initial) { const at = refCursor++; return refs[at] ??= { current: initial }; },
    useEffect() {}, useLayoutEffect() {}, useCallback(callback) { return callback; },
  };
  const wallet = { connection: { address: owner }, auth: { session: { identity: { address: owner } } }, requestForOwner: async (_owner, method) => { assert.equal(method, "eth_sendTransaction"); sends++; throw failure; } };
  const component = compile("../src/components/task-execution.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { __esModule: true, default: "link" },
    "./wallet-provider": { useWallet: () => wallet }, "@/lib/api/task-client": { tasks: { get: async () => task } },
    "@/lib/api/task-account": { accountApi: { get: async () => account }, validateAccount: value => value, assertLive() {}, checkedDeployment: () => data },
    "@/lib/pharmacy-preview": { formatFusdc: value => value }, "@/lib/api/account-evidence": { accountProgress: () => ({ paid: false, completed: false }) },
    ethers: { keccak256: () => `0x${"a".repeat(64)}` }, "@/lib/i18n": { useLocale: () => ({ locale: "ko", t: ko => ko }) },
    "@/lib/scenario-presentation": { merchantLabel: value => value }, "@/lib/auth/wallet": { WalletRequestFailure },
  });
  // Seed the normal restored, same-owner Task state; effects are deliberately inert.
  state[0] = account; state[5] = `${owner.toLowerCase()}:${taskId}`; state[7] = "restored";
  const render = () => { stateCursor = 0; refCursor = 0; return component.TaskExecution({ task, stopped: false, isStopped: () => false, onTask() {} }); };
  render(); refs[3].current = true;
  return { render, stored, get sends() { return sends; }, close: () => { globalThis.sessionStorage = oldStorage; } };
}

test("provider internal failure keeps deployment unknown and reveals only safe diagnostic", async () => {
  const raw = { code: -32603, message: "SECRET_PROVIDER_MESSAGE", data: { transaction: "SECRET_TX_PAYLOAD" } };
  const flow = fixture(new WalletRequestFailure("operation", raw));
  try {
    const deploy = walk(flow.render(), node => node.type === "button" && words(node).includes("Task Account 배포"))[0];
    assert.ok(deploy);
    deploy.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    const display = words(flow.render());
    assert.match(display, /지갑 요청 결과를 확인하지 못했습니다/);
    assert.match(display, /지갑 거래 요청/);
    assert.match(display, /provider_internal/);
    assert.match(display, /-32603/);
    assert.doesNotMatch(display, /SECRET_PROVIDER_MESSAGE|SECRET_TX_PAYLOAD/);
    assert.equal(flow.sends, 1);
    assert.equal(JSON.parse([...flow.stored.values()][0]).hash, null);
    assert.equal(walk(flow.render(), node => node.type === "button" && words(node).includes("Task Account 배포")).length, 0);
  } finally { flow.close(); }
});

test("only explicit provider 4001 clears the unsent marker", async () => {
  const flow = fixture(new WalletRequestFailure("operation", { code: 4001, message: "SECRET_REJECTION_MESSAGE" }));
  try {
    walk(flow.render(), node => node.type === "button" && words(node).includes("Task Account 배포"))[0].props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(flow.stored.size, 0);
    assert.match(words(flow.render()), /사용자가 지갑 요청을 거절했습니다/);
    assert.doesNotMatch(words(flow.render()), /SECRET_REJECTION_MESSAGE/);
    assert.equal(flow.sends, 1);
  } finally { flow.close(); }
});

test("only allowlisted provider wording yields a redacted gas funds category", () => {
  const insufficient = new WalletRequestFailure("operation", { code: -32000, message: "insufficient funds for gas * price + value; SECRET_BALANCE" });
  assert.equal(insufficient.category, "insufficient_gas_funds");
  assert.doesNotMatch(JSON.stringify(insufficient), /SECRET_BALANCE/);
  assert.equal(new WalletRequestFailure("operation", { code: -32000, message: "SECRET_OTHER_FAILURE" }).category, "provider_server");
});
