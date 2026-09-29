# F035 integrated purchase journey / 구매 흐름 통합 검증

Recorded 2026-09-30 08:50 KST. Human owner: Geondong Kim. Implementation: existing Orca GPT-6 Sol workers; independent integration and review: Codex controller. Base: main b464fac8cd51dc2241a369b65292d711b706c93d. PR: https://github.com/web5five/Floww_Frontend_Client/pull/9 . No teammate approval is implied.

## Behavior / 동작

- Overview remains public. Scenario choices, each Task step, chat, voice and task history require a server-authenticated wallet session. An expired session hides the protected view and retains a validated local return path for login.
- Three scenarios lead to separate request, conditions, wallet approval and result pages with a top step indicator. The URL indicates the current view, not proof of completion. Reload, back and chat preserve the same Task. Unknown outcomes and STOP remain locked until authoritative reconciliation.
- The chat microphone and dedicated voice view use the same Task. Owner, chain and session changes stop capture and discard stale transcript callbacks. A late microphone permission result is stopped after expiry. Scenario suggestions require explicit confirmation; voice cannot sign or pay.
- Overview, header, footer and icon use the reconstructed Floww symbol. Native SVG paths and gradients are editable; the raster reference does not establish an exact original vector or font. Mobile wallet entry remains beside the logo.
- Backend API/schema, contract authority and transaction signing are unchanged. Scaffold-ETH 2 toolkit adaptation and its license/source attribution are in F033A_SCAFFOLD_ETH_NOTICE.md.

## Verification / 검증

On the final integrated source, pinned Node 24.19.0:

- `npm run build`: passed, standard Next production build including generated TypeScript checks.
- `npm run lint`: passed.
- `npx playwright test --timeout=60000`: **100/100 passed**, production server, desktop 1440x1000 and mobile 390x844. Uses isolated API/wallet/media fixtures; this is not a newly completed hosted purchase.
- Voice server contract and client lifecycle Node harnesses passed during this integration. Browser coverage includes login gates, return paths, exact amount/authority boundaries, DENY/no broadcast, STOP, unknown outcome recovery, voice rejection/retry/expiry and cleanup.
- Controller inspected the production Overview in the internal browser, mobile header placement, and desktop/mobile Overview, scenario step and voice screenshots. An initial CSS cascade issue and obsolete pre-login selectors were corrected. Virtual-clock installation was moved before application timers; no expired-session assertion was removed.
- `git diff --check`: passed. Latest main was fetched before publication; no new upstream changes were present.

## Hosted acceptance / 배포 검증

Client Preview BFF access to the protected backend was explicitly authorized by the user and provisioned by the deployment owner as a server-only Preview secret. No credential belongs in Git, a public environment variable, a browser bundle or this document. Final Preview deployment and real hosted login/Task/voice checks are separate from local fixture results.

Earlier real OpenAI WebRTC evidence used synthetic authentication/text input; it is not human microphone acceptance. WalletConnect mobile QR still requires a real project ID. A pending Sepolia transaction is owned by the deployment session and must be reconciled before any retry. Do not send another payment to manufacture a fresh result.

Cross-tab logout can leave an already rendered cached view until revalidation; server-side Task and voice authorization remains enforced. Original F007, deployment signer runtime and other checkouts were preserved.

Confluence worklog: **PENDING_SYNC**, intended workflow location page 12517414. This local report does not claim a remote documentation update.
