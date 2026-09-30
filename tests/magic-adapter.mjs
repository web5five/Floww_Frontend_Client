import assert from "node:assert/strict";
import { test } from "node:test";
import { createMagicAdapter, magicConfigured, MAGIC_CHAIN_ID, MAGIC_RPC_URL } from "../src/lib/auth/magic.ts";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const KEY = "pk_12345678"; // Synthetic public-format fixture, never a deploy key.
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fixture({ chainId = "0xaa36a7", address = ADDRESS, otp, logout, loggedIn = true } = {}) {
  const calls = [];
  const listeners = new Map();
  const instance = {
    auth: { loginWithEmailOTP: async () => { calls.push("otp"); await otp?.promise; } },
    user: { isLoggedIn: async () => loggedIn, logout: async () => { calls.push("logout"); await logout?.promise; }, onUserLoggedOut: fn => { listeners.set("logout", fn); } },
    rpcProvider: {
      request: async ({ method }) => { calls.push(method); if (method === "eth_accounts") return [address]; if (method === "eth_chainId") return chainId; throw Error("unexpected method"); },
      on: () => {}, removeListener: () => {},
    },
  };
  const constructors = [];
  const sdkModule = { Magic: class { constructor(key, options) { constructors.push({ key, options }); return instance; } } };
  return { calls, listeners, constructors, sdkModule, loadMagic: async () => sdkModule };
}

test("invalid or missing publishable configuration fails before SDK and OTP", async () => {
  assert.equal(magicConfigured(""), false);
  assert.equal(magicConfigured("sk_secret123"), false);
  assert.equal(magicConfigured("pk_short"), false);
  assert.equal(magicConfigured(KEY), true);
  let loaded = false;
  const adapter = createMagicAdapter({ publishableKey: "", loadMagic: async () => { loaded = true; throw Error("must not load"); } });
  await assert.rejects(adapter.connect("person@example.test", "ko"), { code: "CONFIG" });
  assert.equal(loaded, false);
});

test("OTP returns only a Sepolia wallet provider and ignores DID as identity", async () => {
  const f = fixture();
  const adapter = createMagicAdapter({ publishableKey: KEY, loadMagic: f.loadMagic });
  const wallet = await adapter.connect("person@example.test", "en");
  assert.equal(wallet.id, "magic");
  assert.deepEqual(await wallet.provider.request({ method: "eth_accounts" }), [ADDRESS]);
  assert.deepEqual(f.constructors[0], { key: KEY, options: { network: { rpcUrl: MAGIC_RPC_URL, chainId: MAGIC_CHAIN_ID }, locale: "en", deferPreload: true } });
  assert.deepEqual(f.calls.slice(0, 3), ["otp", "eth_accounts", "eth_chainId"]);
  await adapter.disconnect();
  assert.equal(f.calls.at(-1), "logout");
});

test("wrong chain, missing account and rejected OTP fail closed and clean up", async () => {
  for (const [setup, code] of [[{ chainId: "0x1" }, "CHAIN"], [{ address: "" }, "ACCOUNT"], [{ loggedIn: false }, "OTP"]]) {
    const f = fixture(setup);
    await assert.rejects(createMagicAdapter({ publishableKey: KEY, loadMagic: f.loadMagic }).connect("person@example.test", "ko"), { code });
    assert.equal(f.calls.at(-1), "logout");
  }
});

test("cancelled delayed OTP cannot start another OTP, sign, or retain a session", async () => {
  const otp = deferred();
  const f = fixture({ otp });
  const adapter = createMagicAdapter({ publishableKey: KEY, loadMagic: f.loadMagic });
  const first = adapter.connect("person@example.test", "ko");
  await new Promise(resolve => setImmediate(resolve));
  adapter.cancel();
  await assert.rejects(adapter.connect("person@example.test", "ko"), { code: "PENDING" });
  otp.resolve();
  await assert.rejects(first, { code: "CANCELLED" });
  assert.equal(f.calls.includes("eth_accounts"), false);
  assert.equal(f.calls.includes("personal_sign"), false);
  assert.equal(f.calls.at(-1), "logout");
  assert.equal(adapter.isPending(), false);
});

test("failed logout blocks reconnect, and provider logout event invalidates owner", async () => {
  let lost = 0;
  const f = fixture({ logout: { promise: Promise.reject(Error("logout failed")) } });
  const adapter = createMagicAdapter({ publishableKey: KEY, loadMagic: f.loadMagic, onSessionLost: () => { lost++; } });
  await adapter.connect("person@example.test", "ko");
  f.listeners.get("logout")();
  assert.equal(lost, 1);
  await assert.rejects(adapter.connect("person@example.test", "ko"), { code: "LOGOUT" });
  assert.equal(f.calls.filter(call => call === "otp").length, 1);
});
