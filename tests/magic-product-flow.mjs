// Synthetic Magic provider through the real wallet-auth BFF contract. No OTP, key, or signature is live.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { createMagicAdapter } from "../src/lib/auth/magic.ts";
import { account, chain } from "../src/lib/auth/wallet.ts";
import { walletAuthProxy } from "../src/lib/auth/server.ts";
import { loginReturnTo } from "../src/lib/auth/return-to.ts";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const ORIGIN = "http://localhost:3103";
const TASK_ID = "11111111-2222-4333-8444-000000000037";
const SIGNATURE = `0x${"11".repeat(65)}`;

test("configured Magic provider passes exact SIWE through the owner BFF and clears on sign-out", async () => {
  const nonce = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 290000).toISOString();
  const message = `${ORIGIN} wants you to sign in with your Ethereum account:\n${ADDRESS}\n\nSign in to Floww\n\nURI: ${ORIGIN}\nVersion: 1\nChain ID: 11155111\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}\nExpiration Time: ${expiresAt}`;
  const token = ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ sub: "fixture-owner", role: "USER", aud: ["client"], exp: Math.floor(Date.now() / 1000) + 1700 })).toString("base64url"), randomBytes(32).toString("base64url")].join(".");
  const backendCalls = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    backendCalls.push({ path: request.url, body: JSON.parse(body) });
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.url.endsWith("/nonce") ? { nonce, message, expiresAt } : { accessToken: token, tokenType: "Bearer", expiresIn: 1800, user: { userId: "fixture-owner", role: "USER", wallets: [{ address: ADDRESS }] } }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const previous = Object.fromEntries(["FLOWW_WALLET_AUTH_ENABLED", "FLOWW_WALLET_AUTH_MODE", "FLOWW_API_BASE_URL", "FLOWW_SESSION_SECRET"].map(name => [name, process.env[name]]));
  process.env.FLOWW_WALLET_AUTH_ENABLED = "true";
  process.env.FLOWW_WALLET_AUTH_MODE = "team-jwt";
  process.env.FLOWW_API_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.FLOWW_SESSION_SECRET = randomBytes(32).toString("hex");
  const providerCalls = [];
  let loggedIn = false;
  let logoutCount = 0;
  const magicSdk = {
    auth: { loginWithEmailOTP: async () => { providerCalls.push("otp"); loggedIn = true; return "fixture-did-not-identity"; } },
    user: { isLoggedIn: async () => loggedIn, logout: async () => { logoutCount++; loggedIn = false; }, onUserLoggedOut: () => {} },
    rpcProvider: {
      request: async ({ method, params }) => {
        providerCalls.push(method);
        if (method === "eth_accounts") return loggedIn ? [ADDRESS] : [];
        if (method === "eth_chainId") return "0xaa36a7";
        if (method === "personal_sign") {
          assert.equal(params[0], `0x${Buffer.from(message, "utf8").toString("hex")}`);
          assert.equal(params[1], ADDRESS);
          return SIGNATURE;
        }
        throw new Error(`Unexpected provider method ${method}`);
      },
      on: () => {}, removeListener: () => {},
    },
  };
  const adapter = createMagicAdapter({ publishableKey: "pk_synthetic_fixture", loadMagic: async () => ({ Magic: class { constructor() { return magicSdk; } } }) });
  const request = (action, input, cookie = "") => walletAuthProxy(new Request(`${ORIGIN}/api/wallet-auth/${action}`, {
    method: action === "session" ? "GET" : "POST",
    headers: { Origin: ORIGIN, Host: "localhost:3103", "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}),
  }), action);
  try {
    const wallet = await adapter.connect("person@example.test", "en");
    let connection = { address: account(await wallet.provider.request({ method: "eth_accounts" })), chainId: chain(await wallet.provider.request({ method: "eth_chainId" })) };
    assert.equal(connection.address, ADDRESS);
    assert.equal(BigInt(connection.chainId), BigInt(11155111));
    const challengeResponse = await request("challenge", { address: connection.address, chainId: "11155111" });
    assert.equal(challengeResponse.status, 200);
    const challenge = await challengeResponse.json();
    assert.equal(challenge.format, "team-jwt");
    assert.equal(challenge.message, message);
    const challengeCookie = challengeResponse.headers.getSetCookie().find(value => value.startsWith("floww_wallet_challenge=")).split(";")[0];
    // The dialog may close after connection; the provider and BFF challenge remain available to explicit sign-in.
    const signature = await wallet.provider.request({ method: "personal_sign", params: [`0x${Buffer.from(challenge.message, "utf8").toString("hex")}`, connection.address] });
    const verifyResponse = await request("verify", { challengeId: challenge.id, message: challenge.message, signature }, challengeCookie);
    assert.equal(verifyResponse.status, 200);
    const session = await verifyResponse.json();
    assert.equal(session.identity.address, ADDRESS);
    assert.equal(session.chainId, "11155111");
    const sessionCookie = verifyResponse.headers.getSetCookie().find(value => value.startsWith("floww_wallet_session=")).split(";")[0];
    assert.deepEqual(await (await request("session", undefined, sessionCookie)).json(), session);
    assert.equal(loginReturnTo(`/chat/${TASK_ID}`), `/chat/${TASK_ID}`);
    assert.equal(loginReturnTo("https://evil.test"), "/pharmacy");
    assert.deepEqual(backendCalls.map(call => call.path), ["/api/v1/auth/wallet/nonce", "/api/v1/auth/wallet/verify"]);
    assert.deepEqual(providerCalls.filter(call => call === "personal_sign"), ["personal_sign"]);
    await adapter.disconnect();
    connection = null;
    await request("logout", undefined, sessionCookie);
    assert.equal(connection, null);
    assert.equal(logoutCount, 1);
    assert.equal(loggedIn, false);
    assert.equal(await (await request("session")).json(), null);
  } finally {
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
