# CLIENT-2 pharmacy journey and Task API handoff

Latest: [Task Account execution integration](task-execution-handoff.md) supersedes the disabled-wallet-execution descriptions in this historical report. Hosted acceptance remains separate.

Update 2026-09-30: [purchase studio, ElevenLabs preparation and PR #41 account evidence](purchase-studio-voice.md) supersedes the original server-schema blockers below. The server now implements the TaskAccount execution sequence. This client adds owner-scoped account evidence reads; its wallet spending sequence and deployed acceptance are still pending. The following original handoff preserves the scope of PR #6.

Source contract: Floww_Server `e3a7f75b2248fdfe1f8dd6a64d9659441e53edef`, `TaskController`, `TaskViews`, and the public [Task API](https://github.com/web5five/Floww_Server/blob/e3a7f75b2248fdfe1f8dd6a64d9659441e53edef/docs/TASK_API_KO_EN.md), [AI integration](https://github.com/web5five/Floww_Server/blob/e3a7f75b2248fdfe1f8dd6a64d9659441e53edef/docs/AI_TASK_INTEGRATION_KO_EN.md), [deployment record](https://github.com/web5five/Floww_Server/blob/e3a7f75b2248fdfe1f8dd6a64d9659441e53edef/docs/VERCEL_SUPABASE_DEPLOY_KO_EN.md). Older proposed-only descriptions are superseded for the implemented routes below, not for payment execution.

## Implemented client scope / 프런트 구현

- Landing and primary navigation lead to `/pharmacy`; the prior Nike demo remains at `/dashboard`.
- Existing blue/yellow cards and responsive styles are reused. Wallet login returns to the pharmacy flow.
- Independent local rehearsals show normal, over-budget and wrong-recipient paths. Their ALLOW/DENY/REVIEWED states are explicitly fixtures, not backend authorization or payment evidence. STOP locks the rehearsal. Download is labeled local rehearsal, with null transaction/task data and no server-proof claim.
- Required success-path evidence remains visibly unverified until real integrated evidence exists.
- Separate authenticated server workspace: request entry, Task create/list/read, three server simulator quotes, cost-bearing Kiln proposal, policy ALLOW/DENY, Task/mandate/version/asset metadata, events polling and explicit STOP result.
- `src/app/api/tasks/[[...path]]/route.ts` is a Next.js BFF, **not a Java backend implementation**. It accepts encrypted wallet sessions only, never shared development identity. Allowlist, POST origin checks, bounded payloads, no-store, timeout, redirect refusal and credential redaction apply. Token addresses remain visible because they are public asset metadata.
- Decimal input converts through BigInt to integer strings; no floating-point monetary conversion. Task creation preserves an Idempotency-Key for retrying the same body. Model mutations are never automatically retried. Events are read sequentially in pages; failures pause polling for explicit recovery.
- STOP immediately prevents further local operations; awaiting-approval tasks use the server rejection route and active/executing tasks use cancellation. Server status is shown separately from local STOPPED. Failure never claims remote revocation. Session storage retains the selected task's local STOP record across refresh; server remains authority across devices.

## Allowed backend routes

| Method | Backend path |
| --- | --- |
| POST / GET | `/api/v1/tasks` |
| GET | `/api/v1/tasks/{taskId}` |
| POST | `/api/v1/tasks/{taskId}/quotes` |
| POST | `/api/v1/tasks/{taskId}/ai-proposal` (empty body) |
| GET | `/api/v1/tasks/{taskId}/events` |
| POST | `/api/v1/tasks/{taskId}/mandate/reject` |
| POST | `/api/v1/tasks/{taskId}/cancel` |

The existing AI clarification and legacy execution/evidence UI remains reachable at `/dashboard#backend-workspace`. New Task APIs do not have the legacy evidence JSON route; no endpoint is invented or silently substituted.

## Deliberately unavailable

The public server deployment record reports a mismatch between `PurchaseApproval` and the Smart Account EIP-712 schema and placeholder merchant recipients. Therefore this client does not request spending typed-data signatures or expose confirm/order/payment execution routes. Approval is visibly disabled; read-only server status does not confer spending authority. Payment, receipt reconciliation, fulfillment verification and Task COMPLETED cannot be simulated as live success.

### Selected-purchase alignment

The latest team direction freezes one selected purchase per FlowwTaskAccount: AI chooses, policy validates, terms freeze, then the user authorizes that purchase. Frontend presentation follows that sequence and distinguishes the Task-wide 60 fUSDC cap from Pharmacy A's selected 23.5 fUSDC account cap and exact payment. Local A/B/C fixtures are 23.5 / 64 / 19 fUSDC; B is budget DENY and C is recipient DENY. They remain explicitly local fixtures, not server-generated quotes or live evidence.

The app explains separate wallet interactions for owner deployment, MandateApproval signing, on-chain approval recording, allowance and funding. No signing or transaction request is implemented speculatively. The future interface uses FlowwTaskAccount / version 1 / Sepolia / final verifyingContract, with owner, bytes32 taskId, reviewSnapshotDigest, token, recipient, executor, fulfillmentReporter, maxSpend, uint64 expiresAt and uint256 authorizationNonce. paymentId is not a signed MandateApproval field. No parallel PurchaseApproval format or local ReviewSnapshot hash encoding is introduced.

Backend/contract integration and live E2E are being handled by the integration owner; the frontend does not duplicate those implementations. It awaits the deployed preparation/verification DTOs and ABI, exact shared snapshot vectors, live recipient configuration, funding and execution-state APIs. Payment intent must be persisted before broadcast; unknown results must reconcile the stable paymentId/account/receipt before retry. Task completion requires verified FulfillmentConfirmed, not payment alone.

## Configuration and actual access observation

Use existing server-only `FLOWW_API_BASE_URL`, `FLOWW_WALLET_AUTH_ENABLED`, `FLOWW_WALLET_AUTH_MODE`, `FLOWW_WALLET_CHAIN_IDS`, `FLOWW_SESSION_SECRET`, `FLOWW_BUSINESS_JWT_ENABLED`. Values belong in local/server secrets, not Git or browser code. Task BFF requires team-jwt mode plus business JWT support. Login callbacks/messages must use the actual frontend origin. Do not enable a deployed connection merely because a fixture test passes.

On 2026-09-30 KST an unauthenticated health GET to the documented `floww-server-demo-55jhm6jfc-geond.vercel.app` returned 302 to Vercel SSO; the `floww-server-demo.vercel.app` alias returned 404. This proves the access condition for those requests, **not broken wallet authentication**. Public frontend hosting is not established by a Git merge. Do not copy browser SSO cookies or bypass protection with a browser-visible token.

## Ownership / 담당 구분

Frontend work: pages, navigation, client state, fixtures, server-side Next proxy, API types/adapters, browser tests and handoff. Backend teammate work: Java wallet signature verification/JWT, Task persistence, policy, simulator and Kiln integration. Blockchain teammate work: deployed token/account and executor. Frontend tests do not establish completion of teammates' deployed behavior.

Remaining team handoff: accessible backend deployment and authorized frontend project/origin; server/chain aligned EIP-712 schema; real registry recipients and executor contract; wallet-authenticated integrated run; receipt/fulfillment evidence; DENY/no-signing/no-broadcast proofs. No administrator, email/Magic or KYC functionality is added.

Agent review: Codex, not teammate approval. Confluence PENDING_SYNC (workflow page 12517414). Refs client issue #2; do not close the full integration issue from this change.

## Actual verification / 실제 검증

Windows local checkout: full browser suite 90/90 passed before the final selected-purchase presentation update; afterward all 30 affected landing/purchase/pharmacy/Task cases passed on desktop/mobile. Latest lint, TypeScript and Next production build passed. The standalone Task proxy checks passed (wallet JWT only, route allowlist, amount strings, idempotency, credential redaction and protected-Preview redirect handling). Desktop/mobile landing screenshots were visually reviewed. All 48 source files matched the running original workspace. These are local and fixture checks; authenticated deployed Task calls, actual wallet spending prompts, payment, receipts and fulfillment remain unverified here.
