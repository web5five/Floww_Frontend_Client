# F036B — Scenario, journey, chat and execution language handoff / 언어 전환 인계

- **Task / 작업:** F036B; Orca `task_885a57f67093`, dispatch `ctx_194a01dea589`. Human owner: Kim Geondong; implementation agent: dispatched Codex worker. Recorded 2026-09-30 09:28 KST.
- **Source / 근거:** Current Confluence Challenge B architecture page `11960323` v5 (read 2026-09-30 KST); earlier architecture `11927569` v12 explicitly marks itself superseded; engineering workflow `12517414` v4. The dispatch and coordinator follow-ups authorized the multilingual UI and bounded chat language request. No Confluence F036 task page was identified; this is a local task record, not a synchronized team decision.
- **Repository / 저장소:** Floww_Frontend_Client, branch `feature/f036-scenario-locale` from fetched `origin/main` `5003d0a`. Shared locale foundation was cherry-picked as `edfce67` (source `95cd8a6`) and its cookie fix as `b0e9f23` (source `df6657c`), without editing A-owned files. Implementation commit: `cf9f980`. No push, merge, deployment, signing, payment or external post.

## Implemented / 구현

- `src/components/scenario-experience.tsx`, `src/lib/scenario-presentation.ts`: Korean and English scenario names, progress, journey steps, Task facts, events, chat bubbles, status and denial reasons. Known server reason codes receive localized text; valid bilingual server messages can supply a specific reason. Unknown server errors use a safe locale-specific explanation with a diagnostic code in expandable details. Persisted Task payloads, exact user-entered goals and identifiers are untouched when language changes.
- Authenticated same-Task chat has a labeled text box for bounded display-language commands such as “English please”, “translate to English”, “영어로 보여줘”, and “한국어로 바꿔줘”. It calls `useLocale.setLocale`; unsupported text gets a clear explanation that this box does not call AI. It never sends chat text or triggers Task creation, proposal, order, approval or payment. Voice entry stays available.
- `src/components/task-execution.tsx`, `src/components/account-evidence.tsx`: visible approval, funding, payment, recovery and evidence UI copy and statuses follow locale. Account/signature/chain validation codes map to actionable messages. Transaction business logic and canonical signed data are unchanged.
- `src/app/{pharmacy,dashboard,chat,journey}/**/page.tsx`: server-safe locale-specific page titles. `tests/scenario-locale.spec.ts` verifies language commands and persistence across reload at desktop/mobile widths with one authenticated Task and no duplicate writes. `tests/scenario-experience.spec.ts` checks bilingual denial/status mapping.

## Checks / 검증

- Node `v24.19.0`, Next `16.3.6`, existing shared dependency cache; no install or browser download.
- `npm run typecheck` — passed. `npm run lint` — passed. `git diff --check` — passed.
- `npm run build -- --webpack` — passed on the earlier implementation snapshot before the final chat composer; the controller will build the combined head. The existing MetaMask optional `@react-native-async-storage/async-storage` warning remained. `npm run dev -- --port 3002` with default Turbopack failed because this checkout's `node_modules` symlink points outside Turbopack's filesystem root. `npm run dev -- --port 3002 --webpack` served focused browser tests.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npm run test:e2e -- tests/scenario-experience.spec.ts tests/scenario-locale.spec.ts` before the shared cookie correction: 12 existing scenario tests passed; the 2 new cookie tests failed because server HTML remained `lang=ko`. After cherry-picking the A-owned correction, `tests/scenario-locale.spec.ts` passed 2/2 desktop/mobile, including KO→EN and EN→KO text commands, unchanged authenticated Task and no new POST. `tests/scenario-experience.spec.ts --project=desktop` passed 6/6 before the final chat composer; its updated presentation assertion passed 1/1 after the final code edits. These are browser/API fixture checks, not real wallet, Kiln, chain or user acceptance.

## Pending / 남은 일

- Controller to combine A/B/C changes, run one combined production build and full suite, inspect real settings/chat/voice paths and deployment. No combined-SHA or live-user acceptance is claimed here.
- Header, login and voice controls belong to other owners and are outside this commit. `BackendWorkspace` and `PurchaseForm` have no reachable route consumer in the current app; `DemoOrderProvider` has no visible copy. Their old strings were not treated as product-path acceptance.
- Confluence worklog: **PENDING_SYNC** to the authorized worklog under workflow page `12517414`. This dispatch did not authorize external documentation edits; the controller can sync after integration using the persisted page version.
