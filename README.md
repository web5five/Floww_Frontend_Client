# Floww Client

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
| / | Landing |
| /dashboard | Purchase conditions, local approval/rejection/STOP and activity; optional backend test workspace |
| /pharmacy | Three synthetic quotes, exact base-unit arithmetic, review and local STOP |
| /login | Browser EVM wallet discovery and separate server authentication |

Pharmacy subtotals are 43/47/63 fUSDC against a 60 fUSDC limit. Fees, prescription/identity conditions and recipients remain unverified. A subtotal under budget is not policy ALLOW. Candidate changes clear review confirmation. Actual authorization is disabled. The older Nike demo remains available independently.

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

Team-wallet business requests are gated until JWT support is explicitly enabled and never fall back to a shared development token. confirmed:true is only a legacy test-execution field, not spending authorization. REVIEWED is not payment success. Proposed /api/v1/tasks/** descriptors are not executed.

## Limits

- Local STOP prevents further client actions; it cannot revoke remote execution or on-chain authority.
- No real merchant purchase, payment, spending signature, transaction hash, balance or fulfillment success is synthesized.
- EIP-712 approval, final quote/mandate/execution contracts, deployment URLs and payment/fulfillment evidence remain integration dependencies.
- Pharmacy fixture amounts use six-decimal integer strings and BigInt. Legacy purchase-demo numbers are not suitable for chain settlement.
- Automated wallets are test providers; real browser-extension and deployed end-to-end acceptance remain separate.
- No admin page, Magic/email login, KYC, WalletConnect QR or private key handling is included.

## Work record

The application was developed locally with Codex assistance before this import. Existing shared instructions/templates are preserved. Internal PDFs, private discussions and local Java/PostgreSQL experiments are excluded. See [worklog](docs/worklogs/client-2-import.md) for this branch's verification. No human review, deployment or end-to-end purchase is implied.
