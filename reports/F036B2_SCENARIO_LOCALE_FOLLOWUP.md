# F036B2 — Chat language input and same-Task locale controls / 대화 언어 입력 및 작업 유지

- **Task / 작업:** F036B2; Orca `task_c2542e0963bf`, dispatch `ctx_f4969bc368bb`. Human owner: Kim Geondong; implementation agent: dispatched Codex worker. Recorded 2026-09-30 09:35 KST.
- **Sources / 근거:** Repository `AGENTS.md`; Challenge B architecture Confluence page `11960323` v5 and engineering workflow page `12517414` v4, read 2026-09-30 KST. This follow-up was authorized by the coordinator. No separate accepted F036B2 decision or Confluence task page was identified.
- **Repository / 저장소:** Floww_Frontend_Client, `feature/f036-scenario-locale`; fetched `origin/main` at `5003d0a`. The shared shell source commit `34c87bf` was cherry-picked as local `fae018d` before B2 work; its files were not edited. B2 implementation commit: `470736f`. No push, merge, deployment, cloud operation, signing or payment run.

## Changes / 변경

- `src/components/scenario-experience.tsx` and `scenario-experience.module.css`: unsupported typed input now suggests the supported language requests and the microphone for Task discussion, without implying freeform AI chat. The labeled input, send button, feedback and mic row have explicit responsive spacing, readable feedback and a 16px mobile input font. Locale changes still call only the shared locale setting.
- `tests/scenario-locale.spec.ts`: exercises the actual header control, bounded chat commands and Settings radio on one authenticated Task; reload verifies persistence. Records all non-read `/api/` requests and checks that switching, unsupported text, navigation and reload make no additional writes after the initial Task creation. Also checks Task identity, amount, deadline, English/Korean state and horizontal overflow at 1440, 390 and 320 pixel widths.
- `tests/auth-navigation.spec.ts` and `tests/floww.spec.ts`: align default Overview hero assertions with the integrated Korean default while retaining their login, route, navigation and brand assertions.

## Verification / 검증

- Node `v24.19.0`, Next `16.3.6`, existing dependency and Chrome caches; no installation or browser download. Dev server: `npm run dev -- --port 3002 --webpack` because the shared `node_modules` symlink prevents default Turbopack from serving this checkout.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npm run test:e2e -- tests/scenario-locale.spec.ts tests/auth-navigation.spec.ts tests/floww.spec.ts` — **14/14 passed** across desktop/mobile. After the stronger write guard and selector adjustment, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npm run test:e2e -- tests/scenario-locale.spec.ts` — **2/2 passed** on the final source.
- `npm run lint`, `npm run typecheck`, `git diff --check` — passed. The controller owns the one final combined production build; none was run in this follow-up.
- Browser screenshots inspected: `artifacts/f036b2-chat-desktop.png` (1440), `artifacts/f036b2-chat-mobile.png` (390), `artifacts/f036b2-chat-mobile-320.png` (320). The composer, feedback and mic entry remain visible without horizontal overflow. These are local fixture screenshots, not live wallet, payment, Kiln or user acceptance evidence.

## Integration / 통합 대기

- The voice launcher itself still shows Korean `음성 대화` in the English screenshot, and the voice panel has further Korean copy. It is outside B2 ownership; the controller should integrate the voice owner's localization before claiming strict one-language UI. The visible skip-content overlay also appears in the screenshots and belongs to shared shell styling.
- Controller to combine A/B/C changes, run the full suite and one combined build, and verify the resulting deployed product separately. The scenario test uses API fixtures and does not establish real-user acceptance or payment behavior.
- Confluence worklog: **PENDING_SYNC** to the authorized worklog under workflow page `12517414`; this dispatch forbade external posts. Sync only from the integrated result and read back the persisted version.
