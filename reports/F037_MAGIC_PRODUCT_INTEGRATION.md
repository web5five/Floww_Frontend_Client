# F037 local worklog — Magic product wallet adoption

- **Task / owner / time:** F037, dispatched client implementation worker, 2026-09-30 09:48 KST.
- **Sources:** Floww repository AGENTS.md and README; shared architecture Confluence page `11927569` (current rendered page `11960323`, version 5 at intake), engineering workflow `12517414` version 4, AUTH-03 proposal `14188566` version 1. Server PR31 merged example at `Floww_Server/examples/wallet-signin/magic` and `docs/MAGIC_CONNECTOR_KO_EN.md` (merge `1885f28`) was read locally; server `origin/main` was fetched read-only at `153b5f3`. No Confluence post was authorized; `PENDING_SYNC` for the intended team worklog under `12517414`.
- **Decision status:** This is client implementation of the user's explicit Magic plus MetaMask direction. The server example is prior verified OTP/Sepolia/SIWE/JWT/logout evidence, not this client's live acceptance. No payment, signing authority, canonical Task content or server contract changed.
- **Repository / branch / base / commit:** `Floww_Frontend_Client`, `feature/f036-locale-settings`, latest fetched `origin/main` `5003d0a`, preserving F036 commits `95cd8a6`, `df6657c`, `34c87bf`, `1db9b00`. Scoped implementation commit `49b78d1`; report commit follows this file.
- **Changed paths:** `src/lib/auth/magic.ts` adds lazy Magic adapter, strict publishable key gate, explicit Sepolia network, OTP lifecycle and logout barrier; `src/components/wallet-provider.tsx`, `wallet-toolkit-provider.tsx`, `wallet-connect-dialog.tsx`, `wallet-login.tsx`, `wallet-login.module.css`, `src/lib/auth/use-wallet-auth.ts`, `src/lib/auth/wallet-toolkit.ts` integrate the provider into the existing wallet owner and BFF flow, remove unconfigured alternative choices from the visible login, and guard async cancellation and owner actions. `package.json`, `package-lock.json`, `.env.example`, `README.md`, `docs/F037_MAGIC_WALLET_UI_KO_EN.md` pin and document public configuration. `tests/magic-adapter.mjs`, `tests/wallet-auth.spec.ts`, `tests/wallet.spec.ts` cover the scoped behavior.
- **Contract:** The selected Magic provider supplies `eth_accounts`, `eth_chainId`, and `personal_sign` to existing `/api/wallet-auth` challenge/verify/session/logout calls. Existing exact UTF-8 SIWE validation, origin/address/chain checks, BFF HttpOnly cookie/JWT, returnTo allowlist, same Task and wallet action owner check stay in place. Email, DID and provider name do not authenticate the owner. No transaction was requested.

## Local checks

Node `v24.19.0`; npm `11.11.1`; Next `16.3.6`; cached headless Chromium executable `chromium_headless_shell-1234`. No browser download and no secret values were used.

| Safe command | Result |
| --- | --- |
| `npm install magic-sdk@33.13.0 --save-exact --ignore-scripts --no-audit --no-fund --prefer-offline` | Passed; seven packages added from existing cache. |
| `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/magic-adapter.mjs` | 5/5 passed: missing key, Sepolia/provider, wrong chain/account/OTP, delayed cancellation, logout barrier. |
| `npm run typecheck` | Passed; real installed SDK constructor and network options typechecked. |
| `npm run lint` | Passed, zero warnings. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=<existing headless shell> npx playwright test tests/wallet-auth.spec.ts tests/wallet.spec.ts --project=desktop` | 22/22 passed; BFF fixture paths, wrong origin/address/chain, delayed challenge cancellation, retry, UI configuration gate. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=<existing headless shell> npx playwright test tests/wallet.spec.ts --project=mobile` | 5/5 passed, including English Magic gate and no horizontal overflow. |
| `git diff --cached --check` | Passed before implementation commit. |

Tests use a synthetic `pk_`-format fixture and mocked provider/server responses, explicitly not a real OTP or hosted session. Production build and full combined suite were left to the coordinator because the shared disk had about 1.7 GiB free and the coordinator assigned a separate combined build. Publishable key, server origin allowlist, real Magic OTP, logout/reconnect, hosted return path, CI, merge, push and deployment remain the controller's actions. No cloud, payment, live OTP, push or merge occurred in this worker.

**Review:** independent review was requested by the controller; no human approval is claimed here. Root should inspect the final combined SHA with scenario/voice changes, run the assigned combined build and required CI, and validate the actual configured OTP/BFF owner path before calling it externally verified.
