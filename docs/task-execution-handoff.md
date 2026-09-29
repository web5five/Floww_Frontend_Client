# CLIENT-2 — Task Account client integration

2026-09-30 KST. Frontend owner: Sinwoo Park. Implementation/review: coding agent; not teammate approval.

## Contract and ownership

Source: Floww_Server main tree `9bd8ab3eaf5f5c77306c12145753f4819ec0209a`, [frontend handoff](https://github.com/web5five/Floww_Server/blob/main/docs/FRONTEND_E2E_HANDOFF_KO_EN.md), PR #41 TaskAccountController/Service/TaskViews. The server handoff explicitly identifies frontend `a8a1f459d04f589ca4488c73912592890d2c0c5c` as including merged PR #7. The old `chore/agent-reviewed-merges` comparison is not proof main is missing those commits.

The pinned ABI/creation bytecode is copied from the team's public server artifact, source contract `d4e6a7d7b7635634b8a59f7c87bba91d3b311f9d`. Its compiler/source hash remain recorded in `task-account-artifact.json`. It is used to reject changed constructor calldata, not to deploy a new contract design. Ethers 6.17.0 supplies standard ABI/EIP-712 operations; the shared ReviewSnapshotV1 golden vector is tested.

## Frontend work

- Existing pharmacy screen now connects prepared purchase → owner deployment → receipt/bind → EIP-712 signature → server approval → reconciliation → exact token allowance → funding → idempotent order → payment → simulated fulfillment → verified completion.
- Both server policy and current owner/chain/snapshot are checked. Signed amount is the selected quote total, not the entire Task budget. Server `typedData` is verified and passed unchanged.
- Wallet operations have explicit buttons, synchronous duplicate-click locks, receipt inspection and public recovery records. A lost transaction response is UNKNOWN; it is never silently retried. A known hash can be restored and checked against sender/target/data/value.
- STOP immediately blocks local continuation, including a signature that returns after STOP. Already broadcast transactions are not cancelled, and server cancel is not claimed to revoke on-chain authority or refund funds.
- Existing local demos and evidence predicates are retained. Completion requires Task and Account COMPLETED and VERIFIED payment/fulfillment operations with hashes and timestamps.

## Next.js server work (not Java backend)

Exact owner-JWT BFF routes and per-route body validation; origin/size/time/redirect guards; stable order Idempotency-Key; typedData.message.token preserves only its public address while credentials remain stripped. No executor/private key enters frontend code. No Magic/email login was added.

The Java APIs, DB, Kiln calls, Solidity account, executor/reporter and original public-Sepolia proof belong to the server/chain teammates. This change consumes them rather than claiming their implementation.

## Real environment observations

- Shared public alias `https://floww-server-demo.vercel.app/actuator/health`: HTTP 200, UP.
- Unauthenticated `/api/v1/tasks`: HTTP 401.
- `/api/v1/auth/wallet/nonce` for an ephemeral unfunded test identity: HTTP 401. No JWT issued; no AI call, Task creation, signature verification or chain spending occurred in this live probe.
- Historical protected Preview health: HTTP 302.
- These results agree with the new server handoff: public alias is not the enabled full execution deployment; team-testable URL/origin/access is pending.
- GitHub deployments API currently returns no frontend deployments. Git main publication is not Vercel deployment evidence.
- `.env.local` was not created because the live authentication gate did not pass. Keep actual configuration server-only. ElevenLabs MP3 generation still needs local credentials or an approved generated file.

## Environment names

## Validation / 검증

Local full regression: **112/112 passed**, Windows Chrome desktop/mobile. After adding request-key refresh recovery and manual USER DENY checks, **26/26 affected tests passed**. The initial CI exposed a test locator selecting hidden prerendered radios; the corrected test asserts one visible panel and three visible radios. Production-mode reproduction: **6/6 passed**. Final lint and Next production build (including TypeScript) passed. Ethers 6.17.0 audit reported zero vulnerabilities.

The screenshot files labeled `execution-completed-fixture-*` show mocked responses, not public-chain evidence. Desktop/mobile layout was inspected and horizontal overflow is checked. Actual backend health/nonce observations are listed above; no live frontend wallet purchase was performed.

PR: https://github.com/web5five/Floww_Frontend_Client/pull/8 . Final CI/merge status is available on the PR. The original root workspace and unrelated files were preserved; publication uses the separate client checkout based on main `a8a1f459`.

## Environment names (server only)

`FLOWW_API_BASE_URL`, `FLOWW_WALLET_AUTH_ENABLED`, `FLOWW_WALLET_AUTH_MODE`, `FLOWW_BUSINESS_JWT_ENABLED`, `FLOWW_WALLET_CHAIN_IDS`, `FLOWW_SESSION_SECRET`. `FLOWW_SERVER_DEV_TOKEN` is legacy development access only, never the authenticated Task execution identity. Optional `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` are generation-only and never browser variables.

## Remaining shared acceptance

The deployment owner provides enabled base URL and SIWE frontend origin. The chain owner provides the user's test token/gas. Repeat the UI using a real browser wallet on those exact deployed commits; record new Task/attempt/account IDs, payment/fulfillment hashes, owner isolation, both real DENY cases and refresh recovery. Do not substitute historical team transactions or fixture results. Finality/reorg hardening remains the team's separate scope.

Confluence PENDING_SYNC, target page 12517414; no Atlassian connector. This file is a local/public-safe handoff, not a claim that private documents were synchronized.
