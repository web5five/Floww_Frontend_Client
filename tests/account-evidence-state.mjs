// Fixture-only read path: compile the actual Task client and evidence component.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import * as evidence from "../src/lib/api/account-evidence.ts";

const taskId = "11111111-1111-4111-8111-111111111111";
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
  return typeof tree === "string" ? tree : "";
}
function fixture(reply) {
  const oldFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, init) => { requests.push([path, init]); return reply(); };
  const client = compile("../src/lib/api/task-client.ts", {
    "./task-types": { isBaseUnits: () => true }, "./account-evidence": evidence,
  });
  const cells = []; let cursor = 0;
  const react = {
    useState(initial) { const at = cursor++; if (!(at in cells)) cells[at] = initial; return [cells[at], value => { cells[at] = value; }]; },
    useRef(initial) { const at = cursor++; return cells[at] ??= { current: initial }; },
    useEffect() { cursor++; },
  };
  const component = compile("../src/components/account-evidence.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx }, "lucide-react": { CheckCircle2: "check", Clock3: "clock", ExternalLink: "external" },
    "@/lib/api/task-client": client, "@/lib/api/account-evidence": evidence,
    "@/lib/pharmacy-preview": { formatFusdc: value => value },
    "@/lib/i18n": { useLocale: () => ({ locale: "ko", t: ko => ko }) },
    "@/lib/scenario-presentation": { statusLabel: value => value },
  });
  const render = () => { cursor = 0; return component.AccountEvidence({ taskId, taskStatus: "AWAITING_APPROVAL" }); };
  return { requests, render, close: () => { globalThis.fetch = oldFetch; } };
}

for (const [status, reasonCode, specific] of [
  [409, "CHAIN_NOT_READY", true],
  [409, "CONFLICT", false],
  [500, "CHAIN_NOT_READY", false],
  [401, "UNAUTHORIZED", false],
]) test(`evidence GET ${status} ${reasonCode} renders ${specific ? "account readiness" : "generic failure"}`, async () => {
  const flow = fixture(() => new Response(JSON.stringify({ reasonCode }), { status, headers: { "Content-Type": "application/json" } }));
  try {
    const button = walk(flow.render(), node => node.type === "button")[0];
    button.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    const alerts = walk(flow.render(), node => node.props?.role === "alert");
    assert.equal(alerts.length, 1);
    assert.equal(words(alerts[0]).includes("Task Account 또는 체인 모드"), specific);
    assert.equal(words(alerts[0]).includes("결제 증거를 조회하지 못했습니다"), !specific);
    assert.deepEqual(flow.requests.map(([path, init]) => [path, init.method ?? "GET"]), [[`/api/tasks/${taskId}/account`, "GET"]]);
  } finally { flow.close(); }
});

test("malformed success is not mistaken for account-not-ready", async () => {
  const flow = fixture(() => new Response(JSON.stringify({ taskId }), { status: 200 }));
  try {
    walk(flow.render(), node => node.type === "button")[0].props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(words(walk(flow.render(), node => node.props?.role === "alert")[0]), /결제 증거를 조회하지 못했습니다/);
  } finally { flow.close(); }
});

test("network failure remains a retrieval error", async () => {
  const flow = fixture(() => Promise.reject(new TypeError("offline")));
  try {
    walk(flow.render(), node => node.type === "button")[0].props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(words(walk(flow.render(), node => node.props?.role === "alert")[0]), /결제 증거를 조회하지 못했습니다/);
  } finally { flow.close(); }
});
