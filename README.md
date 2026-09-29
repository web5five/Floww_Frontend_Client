<img width="1672" height="941" alt="ChatGPT Image 2026년 9월 30일 오전 01_56_33" src="https://github.com/user-attachments/assets/599323b0-5701-472b-8192-3d0cddfb3b93" />

<div align="center">

# 🌊 Floww Client

### Your request. Your call. Your flow.

**An AI-assisted purchase experience where every proposal stays in your hands.**

[![Status](https://img.shields.io/badge/Status-Foundation%20in%20Progress-4261FF?style=for-the-badge)](#current-state)
[![Client](https://img.shields.io/badge/Floww-Client-FFFF5C?style=for-the-badge&labelColor=1E1E1E)](#what-is-floww-client)

<br />

### 🔗 Live Demo

<!-- Add the deployed client URL when it is available. -->
**Coming soon** · [Add live URL here](#)

<br />

[Integration Hub](https://github.com/web5five/Floww) · [Server Integration Issue](https://github.com/web5five/Floww_Server/issues/1)

</div>

---

## ✨ What is Floww Client?

Floww Client is the user-facing application for requesting, reviewing, and following an AI-assisted purchase.

It is designed to keep the user informed and in control at every step:

**Request → Delegation → Wallet Approval → Progress → Result → Recovery**

> 🛡️ The client should make consequential actions clear, visible, and intentional.

---

## 🧭 The User Journey

| Step | Experience |
|---|---|
| 📝 **Request** | The user describes what they want to do. |
| 🤝 **Delegation** | The user reviews and confirms the mandate before work begins. |
| 🔐 **Wallet approval** | The user reviews the transaction and approves it with their wallet. |
| ⏳ **Progress** | The client shows the current state while the request is being processed. |
| ✅ **Result** | The user sees the outcome and relevant details. |
| 🧰 **Recovery** | When something fails or needs attention, the client explains what happened and what to do next. |

---

## 🚧 Current State

The Next.js client includes local purchase/pharmacy previews, wallet-login adapters and server-proxied API screens. Installation, lint, type checking, production build and browser tests are available. Actual spending approval, payment and verified fulfillment remain integration work.

---

## 🗺️ Roadmap

The client foundation will grow into a working application through small, verifiable steps:

- [x] Establish the application structure and supported runtime.
- [x] Pin dependencies and provide a reproducible installation flow.
- [x] Add placeholder-only environment variable examples.
- [ ] Build the request and mandate confirmation experience.
- [ ] Add wallet approval and transaction status screens.
- [ ] Show progress, results, and actionable recovery states.
- [x] Add a real build and test workflow.
- [ ] Verify startup and health in the intended environment.
- [ ] Deploy the client and add its live URL above.

---

## 🧑‍💻 Starting a Component Task

1. Read [`AGENTS.md`](./AGENTS.md) and the latest shared architecture and API contract.
2. Fetch remote refs, preserve teammate work, and open a bounded issue and feature branch.
3. Pin the runtime and dependencies, and make installation reproducible.
4. Add placeholder-only environment examples; never commit secrets.
5. Add a real build/test job and verify startup and health in the intended environment.
6. Link actual results in a PR and a bilingual Confluence handoff.

---

## 🏗️ Architecture Notes

Redis, pgvector, Kafka, Eureka, and Config Server are deferred baseline services. Do not add them just to populate an empty repository. Add only the dependencies required by an implemented client feature.

Keep secrets and private team sources out of Git.

---

## 🔗 Project Links

| Resource | Link |
|---|---|
| 🌐 Integration hub | [web5five/Floww](https://github.com/web5five/Floww) |
| ⚙️ Server integration issue | [Floww_Server — Issue #1](https://github.com/web5five/Floww_Server/issues/1) |
| 🚀 Live client | **Coming soon** · [Add live URL here](#) |

---

<div align="center">

### Clear choices. Visible progress. Your flow. 🌊

</div>


---

## Implementation and runbook

Floww helps users review purchase conditions and bounded spending proposals. This client includes local purchase/pharmacy previews, a server-side API proxy and wallet-login integration. It does **not** implement a complete payment or fulfillment flow.

[Integration hub](https://github.com/web5five/Floww) | [Client journey issue](https://github.com/web5five/Floww_Frontend_Client/issues/2) | [Server integration issue](https://github.com/web5five/Floww_Server/issues/1)

## Run

Node.js 24.19.0 / npm 11.17.0; Next.js 16, React 19, TypeScript, Tailwind 4 and App Router.

~~~sh
npm ci
npm run dev -- --port 3001
~~~

Open http://127.0.0.1:3001. No backend configuration is required for local demos.

| Route | Behavior |
| --- | --- |
| / | Pharmacy-first landing |
| /dashboard | Purchase conditions, local approval/rejection/STOP and activity; optional backend test workspace |
| /pharmacy | Local pharmacy rehearsal, evidence checklist and authenticated server Task workspace |
| /login | Browser EVM wallet discovery and separate server authentication |

Local pharmacy subtotals are 23.5/64/19 fUSDC against a 60 fUSDC Task limit; B demonstrates budget denial and C an unauthorized recipient. Fees, prescription/identity conditions and recipients remain unverified. A subtotal under budget is not policy ALLOW. Candidate changes clear review confirmation. Actual authorization is disabled. The older Nike demo remains available independently.

## Checks

~~~sh
npm run lint
npm run typecheck
npm run build
~~~

With Google Chrome installed and the development server running on port 3001:

~~~sh
npm run test:e2e
node --conditions=react-server --experimental-strip-types tests/wallet-health.mjs
~~~

Set PLAYWRIGHT_BASE_URL for another running instance. Browser/API fixtures are not live purchase evidence. Production local preview: npm run build, then npm start -- --port 3001.

## Server-only configuration

Copy .env.example to .env.local. Never commit real values.

| Variable | Meaning |
| --- | --- |
| FLOWW_API_BASE_URL | Backend origin; remote wallet traffic requires HTTPS |
| FLOWW_SERVER_DEV_TOKEN | Optional legacy development API credential; never wallet identity |
| FLOWW_WALLET_AUTH_ENABLED | true only when corresponding server wallet support is enabled |
| FLOWW_WALLET_AUTH_MODE | team-jwt by default; local-session is a separate comparison adapter |
| FLOWW_WALLET_CHAIN_IDS | Allowed decimal chain IDs matching backend |
| FLOWW_SESSION_SECRET | Server-only random 32-byte key encoded as 64 hex characters; stable across instances |
| FLOWW_BUSINESS_JWT_ENABLED | Leave unset until business APIs accept wallet JWTs and enforce ownership |

No secrets belong in NEXT_PUBLIC_* or browser storage. Team JWTs are encrypted in HttpOnly/SameSite=Strict cookies, Secure in production. The backend login-message origin must match the frontend origin. Missing settings never fabricate success.

## API and authority boundaries

The Next allowlist proxy supports health/readiness, AI drafts, test execution create/run/list/history/detail, event polling and evidence JSON. These are adapters, not deployed-service claims. No SSE or direct browser Kiln calls.

Wallet login uses /api/v1/auth/wallet/nonce and /api/v1/auth/wallet/verify. A read-only health probe precedes signing. Server failures never trigger automatic repeated signatures. Session lookup reads the encrypted BFF cookie; logout clears this browser session only. Backend JWT revocation/refresh is unavailable in this adapter. Login is not mandate approval.

Team-wallet business requests are gated until JWT support is explicitly enabled and never fall back to a shared development token. confirmed:true is only a legacy test-execution field, not spending authorization. REVIEWED is not payment success. Legacy proposed descriptors remain inert. The separate /api/tasks BFF now connects the implemented Task create/list/read, quotes, AI proposal, events, reject and cancel routes using the current server contract. Spending approval/order routes remain unavailable pending chain alignment.

## Limits

- Local STOP prevents further client actions; it cannot revoke remote execution or on-chain authority.
- No real merchant purchase, payment, spending signature, transaction hash, balance or fulfillment success is synthesized.
- EIP-712 approval, final quote/mandate/execution contracts, deployment URLs and payment/fulfillment evidence remain integration dependencies.
- Pharmacy fixture amounts use six-decimal integer strings and BigInt. Legacy purchase-demo numbers are not suitable for chain settlement.
- Automated wallets are test providers; real browser-extension and deployed end-to-end acceptance remain separate.
- No admin page, Magic/email login, KYC, WalletConnect QR or private key handling is included.

## Work record

The application was developed locally with Codex assistance before this import. Existing shared instructions/templates are preserved. Internal PDFs, private discussions and local Java/PostgreSQL experiments are excluded. See [worklog](docs/worklogs/client-2-import.md) for this branch's verification. No human review, deployment or end-to-end purchase is implied.


## Latest Task integration handoff

See [client Task handoff](docs/client-task-handoff.md) for the exact server commit, implemented routes, hosting access observation, frontend/backend ownership and remaining live acceptance gates.
