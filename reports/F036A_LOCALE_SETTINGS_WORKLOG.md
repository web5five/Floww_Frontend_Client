# F036A — Client language foundation and settings

- **Owner / 담당:** Geondong Kim, Codex implementation worker `task_a260cd45abcf`
- **Recorded / 기록:** 2026-09-30 09:24 KST
- **Repository / 저장소:** `Floww_Frontend_Client`, branch `feature/f036-locale-settings`, base `origin/main` at `5003d0a`
- **Source / 근거:** Current primary architecture Confluence page `11960323` v5; historical architecture page `11927569` v12 marks itself superseded; engineering workflow page `12517414` v4. No F036 task page was found in Confluence; the coordinator dispatch is the assigned task. Policy `FLOWW-AGENT-2026-09-29-03` and the current Floww `AGENTS.md` were read.
- **Decision / 결정:** F036 shared contract: `Locale = "ko" | "en"`, `LocaleProvider`, `useLocale()` with `{ locale, setLocale, t(ko, en) }`. Korean is the default. Display language is a persistent browser preference, separate from Task data and signing content.
- **Sync / 동기화:** `PENDING_SYNC` to engineering worklog under page `12517414`: this dispatch forbids external messages/writes. No Confluence edit or team acceptance is claimed.

## Implemented / 구현

- `src/lib/i18n.tsx`, `src/lib/locale-config.ts`, and `src/app/layout.tsx`: cookie-backed server locale, shared client context, document language, translated shell/footer, and route refresh after preference changes. The cookie name lives in a server-safe module; no local-storage hydration flash. Dynamic root metadata follows the cookie.
- `src/app/page.tsx`, `src/app/overview.module.css`, `src/app/settings/`, `src/components/header.*`: Korean or English Overview, public settings with one real language preference, keyboard radio controls, visible compact KO/EN control and wallet button on mobile. No Task content changes.
- `src/components/wallet-login*`, `src/components/wallet-connect-dialog.tsx`, `src/components/protected-experience.tsx`, `src/components/wallet-toolkit-provider.tsx`, `src/lib/auth/use-wallet-auth.ts`, `src/components/ui.tsx`, and owned app login/not-found files: selected-language guidance, status and error text, RainbowKit locale, and translated generic states. Auth error codes and dialog error codes retranslate on locale change. Canonical SIWE challenge checks and signed message content were left intact.
- `tests/locale-settings.spec.ts`: browser regressions for single-language shell, server response language, reload persistence, Korean navigation, login `returnTo`, mobile overflow, pending dialog error translation, and mock wallet connection continuity.

## Checks / 검증

Environment: Node `v24.19.0`, npm `11.11.1`, Next.js `16.3.6`, existing Google Chrome. No browser download or dependency installation.

| Command | Result |
| --- | --- |
| `git fetch origin` | `origin/main` `5003d0a`; clean starting checkout, original branch preserved |
| `npm run lint` | pass, zero warnings |
| `npm run typecheck` | pass |
| `npm run build` | pass; `/settings` and `/` dynamically server-rendered |
| `npm run test:e2e -- tests/locale-settings.spec.ts` | 7 passed; 1 desktop-only skip for the mobile viewport case |
| `npm run test:e2e -- tests/auth-navigation.spec.ts tests/wallet.spec.ts` | 14 passed, 2 failed: old Overview test in each project expects English `Buy with` under the new Korean default |
| `git diff --check` | pass |

Ignored local screenshots: `artifacts/f036a-overview-{ko,en}-{320,390}.png`. I inspected both 320 px languages; the Playwright checks also covered 390 px, settings, Overview and login with no horizontal overflow and a visible wallet control. Browser tests used an injected test provider only: they do not show real wallet sign-in, payment, or deployment acceptance.

## Handoff / 인계

Commits: `95cd8a6` shared foundation, `df6657c` server-safe cookie correction, and `34c87bf` localized UI and tests. The controller owns integration, updates to the old Overview expectation, and any push/merge/deployment. Korean-only route metadata remains in unowned `src/app/dashboard/page.tsx`, `src/app/pharmacy/page.tsx`, `src/app/chat/[taskId]/page.tsx`, and `src/app/journey/[taskId]/[step]/page.tsx`; their owners should render localized titles server-side. Caller-provided labels in unowned features also need combined-screen review. No live backend, wallet signature, transaction, or cloud action was run.
