# F036C — Voice conversation language handoff

**Status:** Implemented and locally verified, pending controller integration and live acceptance.  
**Task:** F036C / `task_52d8b852befb` / `ctx_bd7455a90581`  
**Owner:** Geondong Kim, Orca implementation worker  
**Time:** 2026-09-30 09:24 KST  
**Repository:** Floww_Frontend_Client, `feature/f036-voice-language`, base `origin/main` at `5003d0a`.
**Implementation commit:** `115a22d` (local only; no push or merge).

## Sources and decision boundary

- Current Confluence architecture `11960323` version 5 and selected-purchase decision `14516275` version 5, read via Atlassian MCP on 2026-09-30 KST. Historical architecture `11927569` version 12 points to the current pages. Engineering workflow `12517414` version 4 and OT requirements `11895204` version 2 were also checked.
- Shared locale contract supplied by the controller: `src/lib/i18n.tsx` exports `LocaleProvider`, `useLocale`, `Locale`, and `t(ko, en)`. The foundation commits were cherry-picked as `817d3f4` (source `95cd8a6`) and `af6876f` (source `df6657c`). The latter moves the cookie name to a server-safe module. This worker did not edit those shared files.
- Voice remains conversation and navigation only. It does not approve, sign, pay, order, or change a Task's canonical content. The server still checks the owner-scoped Task, and a scenario request still requires on-screen confirmation.

## Component changes

- `src/components/voice-agent.tsx`, `src/app/voice/page.tsx`: localized voice page, chat microphone launcher, controls, statuses, transcript labels, errors, and scenario confirmation. On a locale change, the active session releases its microphone, peer, data channel, and audio, clears pending confirmation and transcript, and presents a translated restart notice. Restart requires a new click.
- `src/lib/voice/client-session.ts`: Korean and English connection recovery text, with Korean retained as the default for existing callers.
- `src/lib/voice/session-server.ts`: optional `locale=ko|en` query parameter, default `ko`; reject unknown or duplicate values. The server's Realtime instructions require the selected language while retaining all purchase authority restrictions. The server-only API key remains on the server.
- `tests/voice-agent-contract.mjs`, `tests/voice-agent-lifecycle.mjs`, `tests/voice-agent.spec.ts`: validate language input, server prompt, recovery text, desktop and mobile English voice UI, task binding, and zero purchase mutations in the fixture.

`VoiceGuide` and `/api/voice-guide` are not imported by any rendered route or component. Their prerecorded Korean-only audio is outside the active voice conversation path; no English audio asset was invented or played. Controller can decide whether to remove or separately translate that dormant guide before making it visible.

## Checks run

Node 24.19.0, npm 11.11.1, Next.js 16.3.6; existing dependency cache only. Dev browser ran locally on port 3004 with `--webpack` because Turbopack rejected the checkout's external `node_modules` symlink. No live voice provider or payment call was made.

| Command | Result |
| --- | --- |
| `node --conditions=react-server --experimental-strip-types tests/voice-agent-contract.mjs` | Passed: auth, owner context, locale default and English, malformed locale, secrets, throttle, tool allowlist. |
| `node --experimental-strip-types tests/voice-agent-lifecycle.mjs` | Passed: resource release, transcript lifecycle, and Korean/English recovery messages. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed with zero warnings. |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3004 npm run test:e2e -- tests/voice-agent.spec.ts` | 6 passed across desktop and mobile using browser fixtures. English session requested `locale=en`; scenario remained on-screen with no purchase mutation. |
| `npm run build -- --webpack` | Passed. Existing MetaMask SDK optional React Native AsyncStorage resolution warnings appeared. |

The initial English browser test failed while the shared root layout imported the cookie name across a client-module boundary. After the foundation fix, direct HTML returned `lang=en` and `initialLocale=en`, and the English desktop/mobile tests passed. This report does not claim final combined branch verification, hosted voice access, a live OpenAI session, payment, or user acceptance.

## Handoff

Controller: integrate this local branch with the remaining F036 surfaces, run the combined build and locale-switch regression, and decide whether the unused Korean audio guide should remain dormant. This record is `PENDING_SYNC` for the designated worklog under Confluence page `12517414`; no external page was edited under this worker dispatch. The preexisting generated `next-env.d.ts` change was preserved outside the scoped commit.
