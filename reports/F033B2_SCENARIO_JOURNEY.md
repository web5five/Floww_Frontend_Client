# F033B2 — Scenario and chat corrective worklog / 시나리오·대화 수정 기록

**Status:** source committed; **PENDING_SYNC** to Confluence engineering worklog page `12517414`. The coordinator forbade external postings in this dispatch; no live Atlassian MCP read or write was available here. Architecture page `11960323` v5 and engineering page `12517414` v4 are dated local snapshots, not claims of current synchronization. This corrective record supersedes the acceptance claims in `F033B_SCENARIO_UX.md`; the earlier fixture run does not verify this B2 source.

## Identity and source / 식별·출처

- Task `task_d04d71fb51bc`, F033B2; human owner Geondong Kim; dispatched implementing agent; 2026-09-30 07:24 KST.
- Client repository `web5five/Floww_Frontend_Client`; branch `feature/scenario-chat-experience`; base and freshly fetched `origin/main` `b464fac8cd51dc2241a369b65292d711b706c93d`; source/test commit `411e449e8c975b579d3fe8157fe05252b500d34d`, navigation assertion correction `57350a1d5188a13c94b52f2b0e290afe60372947`. No PR, push, merge or deployment.
- Local authority: `/Users/geondongkim/Floww/control/F033_FRONTEND_MULTISESSION.md`; dated architecture extract `F033_ARCHITECTURE_SOURCE.md` from Confluence `11960323` v5. Selected purchase: server quote and deterministic policy first, then exact purchase approval through the existing TaskExecution; wallet login grants no spending authority.
- SHA-256: `src/components/scenario-experience.tsx` `30db2df38335ed9a3986072983a2a50bca22f622930a318bbd824582f5c05855`; `src/lib/scenario-presentation.ts` `2ca57a6eba187c06cd5bc78c2df600c22f3b666e1adb0c7fecbaa7eea326ed7a`.

## Implemented / 구현

- Clicking an authenticated card starts or resumes one persisted Task, reads its event pages, requests its three quotes, and submits either the real AI proposal request for the normal case or a clearly user-origin policy probe for budget/recipient cases. Purpose, total cap, deadline and seller are prominent; editing is collapsed; IDs and raw policy/transaction details remain in evidence details.
- The chat route renders the same Task as user and Floww bubbles derived from Task state and persisted server events. It can continue a selected scenario on an existing Task without creating a second Task or payment path. Result text distinguishes policy DENY, approval, active payment, unknown payment, and server-recorded completion.
- A per-owner/scenario intent with idempotency key is saved before create; unknown create/proposal/attempt outcomes remain locked across reload. Current owner, Task ID, scenario and generation gate every asynchronous result and TaskExecution callback. STOP locks local continuation immediately and then requests server stop. The runner never signs, expands a mandate, or marks a transaction successful by itself.
- `src/app/globals.css` adds responsive progress and chat bubbles. Old navigation/rehearsal specs were migrated to the current entry routes and Task experience: `tests/floww.spec.ts`, `pharmacy.spec.ts`, `scenario-experience.spec.ts`, `account-evidence.spec.ts`, `backend-pagination.spec.ts`; `backend.spec.ts` and `task-journey.spec.ts` retain proxy/credential and exact-unit security checks. The removed voice UI spec targeted a feature outside F033 scope. Denial and no-payment assertions live in the new scenario spec and existing TaskExecution boundary specs remain intact.

## Checks and limits / 확인·한계

- Node `v24.21.0` with the shared ignored `node_modules` symlink; no dependency installation or build in B2. `git fetch origin` succeeded and `origin/main` remained at the base above. `npm run typecheck`: pass; `npm run lint`: pass with zero warnings; `git diff --check`: pass on the B2 source.
- Focused source-only Playwright command: `npx playwright test tests/task-journey.spec.ts tests/backend.spec.ts tests/backend-pagination.spec.ts tests/pharmacy.spec.ts tests/scenario-experience.spec.ts tests/account-evidence.spec.ts --grep 'task boundary|server proxy contract|chat event pagination|server amounts|presentation maps|hashes, paid state' --project=desktop` — **6 passed**. These exercise pure presentation, exact units, proxy credential isolation and evidence semantics, not browser navigation.
- Browser fixture specs for one-click Task/quotes/policy, B/C DENY without payment controls, same-Task chat/reload, unknown create/proposal locks, STOP, evidence and responsive navigation were updated but **not run on B2** because the controller reserved port 3001 for A and explicitly deferred B runtime/build to combined integration. Fixture tests intercept API results; they are not live Kiln, wallet, Sepolia, fulfillment or user acceptance. No chain write, secret read or external message was made.

## Integration seam and next owner / 통합 접점

- `src/components/header.tsx:8` still renders the compile-safe `/login` link. The coordinator explicitly directed keeping this seam because A's `src/components/wallet-login-button.tsx` is absent from this checkout while A2 is editing it. After A+B combine, replace that link and its `useWallet` display logic with `<WalletLoginButton className="button primary header-login" />`, importing from `./wallet-login-button`; then run typecheck, lint, build, browser journey and wallet modal recovery on the combined source.
- F033A owns dependencies, layout, wallet, auth, API and TaskExecution; this B2 commit edits none of them. A still must remove its layout-level visible development labels. Controller must independently validate the combined build and same-Task browser flow against the actual wallet/session/server; admin cross-app audit and hosted acceptance remain pending. Review and team acceptance have not been recorded.

The earlier proposal to expose create/quotes/proposal as separate technical buttons was rejected for the primary journey. The chosen implementation sends them in sequence behind one user scenario choice, while keeping wallet approval explicit and server outcomes authoritative.
