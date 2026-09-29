# F035B scenario journey handoff

- Task: `task_d957f30438c2` / dispatch `ctx_cd60eeb838fd`; worker: Orca B; owner: Geondong Kim; 2026-09-30 08:40 KST.
- Repository: Floww_Frontend_Client, `feature/scenario-chat-experience`; base `9b79a7e` (F034 boot fix), code commit `1409f79a1c3e2d5452b9f6c5be1a6ac60fb88d9b`. Fetched `origin/main` before and after work; it remained `b464fac8cd51dc2241a369b65292d711b706c93d`.
- Source status: Confluence architecture page `11927569` v12 and engineering workflow page `12517414` v4 metadata/summary read via Atlassian MCP. Local resume instructions: `control/F035_FAST_RESUME.md` and `control/REBOOT_RESUME_20260930.md`. This is an implementation handoff, not a new architecture decision. No Confluence write was authorized in this dispatch.

## Implemented

- Added `/journey/[taskId]/[step]` with `mandate`, `decision`, `approval`, and `result` views. The top step indicator identifies the current page only; URL position does not claim prior purchase approval or completion.
- Three scenario choices create or reopen one stored backend Task. The mandate view reads the Task; the decision view performs the existing quote/proposal or manual attempt once; the approval view mounts the existing `TaskExecution` only for server `ALLOW`; the result view displays persisted status and events. Navigation, reload, back, and chat links retain the same Task ID and scenario. `/pharmacy?taskId=...` redirects to its route-backed mandate view.
- Preserved owner/generation checks, the Task and decision session markers, STOP persistence, unknown result lock, and the existing wallet and payment controls. A saved Task on `/pharmacy` offers a reopen link; an unresolved creation remains unknown and does not create a second Task.
- Kept the F034B wallet dialog close/reopen and mobile CSS edits. Removed the temporary `next.config.ts` root override from the final diff; restored generated `next-env.d.ts` to tracked content. The local `node_modules` symlink caused default Turbopack to panic without the override, so final local browser checks used `next dev --webpack` on port 3002. No dependency install or full build was run.

Changed paths: `src/app/journey/[taskId]/[step]/page.tsx`, `src/app/pharmacy/page.tsx`, `src/components/scenario-experience.tsx`, `src/components/wallet-connect-dialog.tsx`, `src/components/wallet-login.module.css`, `src/app/globals.css`, and `tests/scenario-experience.spec.ts`. Shared auth/layout, Overview, header, API/BFF, wallet execution, and voice files were not edited.

## Verification and limits

- `npm run typecheck`, `npm run lint`, `npx tsc --noEmit`, and `git diff --check`: passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npx playwright test tests/scenario-experience.spec.ts --timeout 60000`: 12/12 passed at 1440 and 390 after webpack warmed. A first cold webpack run timed out during route compilation; the subsequent complete run passed. After the final step-state and reopen changes, the primary route test passed again on mobile and desktop (desktop used a warmed server). The test checks same Task across route, reload, browser back and chat; two DENYs without payment controls; explicit approval placement; STOP; unknown create/proposal no duplicate POST; and delayed session selection.
- Rendered and inspected `artifacts/scenario-mandate-{desktop,mobile}.png` and `artifacts/scenario-approval-{desktop,mobile}.png` (local ignored fixture screenshots). Step bar and content fit both widths without horizontal overflow in the tested path. The approval fixture remains awaiting wallet action; it does not prove a transaction.
- All browser API responses above were Playwright fixtures. Actual wallet login, backend/Kiln, chain payment, fulfillment, deployment, and user acceptance remain unverified. Root owns the protected layouts/login return flow and combined integration checks. No push, PR, merge, deployment, approval, or external message was performed.

Controller review requested neutral previous-step styling and saved Task reopening; both changes are in `1409f79`. Reviewer is the Orca controller agent; no teammate or human approval is claimed. `PENDING_SYNC` to designated Confluence worklog under team authorization; local record only for this dispatch.
