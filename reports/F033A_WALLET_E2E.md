# F033A — wallet toolkit and Task Account client handoff

**Status:** locally implemented and source checked; combined build, browser wallet, protected Preview and live purchase gates remain pending. **Task:** F033A / Orca `task_6a8f0e1ab0ad`. **Owner:** Geondong Kim's dispatched Codex worker. **Recorded:** 2026-09-30 KST. **Confluence:** `PENDING_SYNC` to the engineering worklog location under page `12517414` because this dispatch forbade posting outside Orca.

## Sources and scope

- Client `web5five/Floww_Frontend_Client`, branch `feature/scaffold-wallet-e2e`, base and latest fetched `origin/main` `b464fac8cd51dc2241a369b65292d711b706c93d`. No push, PR, merge, deployment, credential read or chain write was performed. The resulting local commit is supplied in the Orca worker handoff.
- Source decisions: current Challenge B architecture Confluence page `11960323` v5, superseding general architecture page `11927569` v12; engineering workflow page `12517414` v4. F033 local control documents were read in full. Read-only server reference `a8ffb9b1baa75d1482a12801ad58a18f6f42c88c` and `docs/FRONTEND_E2E_HANDOFF_KO_EN.md` govern the 14-step Task Account sequence.
- Scaffold-ETH 2 official source pinned at `6cdf354a4a02aded39c92d5e0d83cd24e4628239`; [provenance and MIT notice](../docs/F033A_SCAFFOLD_ETH_NOTICE.md). Adapted only the RainbowKit/wagmi/viem provider and custom connect pattern. No burner wallet, faucet, starter app or contract was imported.

## Implemented / 구현

- Added pinned RainbowKit `2.2.11`, wagmi `2.19.5`, viem `2.53.1` and TanStack Query `5.100.5`. `src/lib/auth/wallet-toolkit.ts` targets Sepolia and configures injected wallets without a WalletConnect project ID; browser verification is pending. QR choices require optional `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- Added `WalletToolkitProvider`, connector bridge and `WalletLoginButton({ className?: string })`. The button opens wallet choice and follows its own successful connection to `/login`, where a separate server SIWE signature is explicit; authenticated continuation goes to `/dashboard`. It does not treat wallet connection as authentication or spending approval. Existing `useWallet` members and `TaskExecution` props remain available. Account, chain, disconnect and owner checks still invalidate wallet actions; no automatic spending signature or transaction was added.
- Login displays full connected address with copy control, retry and disconnect. Layout metadata and footer no longer claim a disconnected payment flow or use a forbidden development label.
- PR8's account flow remains the server44 sequence: create/quote/AI or manual attempt, prepare/deploy/bind, exact server typed data/signature, approve/reconcile, exact token allowance/fund, stable order key, payment/reconcile, fulfillment/reconcile. Task and account states remain distinct. `TaskExecution` now stores a hash of public wallet transaction input for receipt matching, migrates old public recovery records, preserves pending hashes, bounds automatic reconcile to three visible-page attempts, and uses same-tab session storage to block repeat approve/payment/fulfillment POST after an uncertain response until server state advances. Purchase purpose, selected merchant, amount, cap and expiry appear before expandable technical evidence.
- `src/lib/api/preview-bypass.ts` adds optional server-only `FLOWW_SERVER_VERCEL_BYPASS_SECRET` to allowlisted upstream Floww requests from the validated `FLOWW_API_BASE_URL` only. This covers wallet health, nonce/verify, legacy auth, Task BFF and legacy business proxy. Redirects fail closed, and no bypass value is returned in browser JSON or headers. Placeholder-only `.env.example` names the optional variables. The backend Preview protection and secret provisioning remain the deployment owner's work.
- Task BFF now rejects malformed JSON media types and invalid UTF-8, while retaining chunked body limits, no-body AI calls, integer string amounts, order idempotency and public `typedData.message.token`.

## Checks / 검증

| Command / evidence | Result |
| --- | --- |
| `git fetch origin --prune` at start and before handoff | `origin/main` stayed `b464fac8cd51dc2241a369b65292d711b706c93d` |
| Baseline `npm ci` with local Node 25.8.1/npm 11.11.1, before wallet lock change | 375 packages installed; unsupported engine warning against pinned Node 24; not a new-lock reproducibility check |
| `PATH=/Users/geondongkim/.npm/_npx/387698761821791d/node_modules/node/bin:$PATH npm install --save-exact --ignore-scripts --no-audit --no-fund @rainbow-me/rainbowkit@2.2.11 @tanstack/react-query@5.100.5 viem@2.53.1 wagmi@2.19.5` | Passed on Node 24.21.0; 455 packages added; package and lockfile pinned |
| `PATH=<Node24 bin>:$PATH npm run typecheck` | Passed; Next route types generated and TypeScript no errors |
| `PATH=<Node24 bin>:$PATH npm run lint` | Passed, zero warnings |
| `PATH=<Node24 bin>:$PATH node --conditions=react-server --experimental-strip-types tests/task-proxy.mjs` | Passed Task JWT, allowlist, exact amount, no-body AI, idempotency, redaction, invalid media/UTF-8 and protected Preview header checks |
| Same Node command for `tests/wallet-health.mjs`, `tests/wallet-auth-proxy.mjs`, `tests/wallet-team-proxy.mjs` | Passed health, auth, encrypted cookie, expiry, owner JWT gate and optional Preview header checks |
| `git diff --check` | Passed |

The BFF checks use local fixtures, not a deployed Preview or public Sepolia transaction. The no-project-ID RainbowKit modal and bridge have not yet passed a browser test. The new lockfile has not yet been reinstalled with `npm ci`, and no Next production build was run in this worktree; the coordinator reserved one combined A/B build and browser check due shared disk pressure. `node_modules` was about 1.1 GiB after install; operation-time `df -h .` before handoff showed 706 MiB free. No browser download was made.

## Integration owner / 다음 단계

F033B imports `WalletLoginButton` from `src/components/wallet-login-button.tsx` without changing `useWallet` or `TaskExecution` props. The coordinator should combine A/B source, run `npm ci` with Node 24, lint/typecheck/build and browser checks for modal → SIWE → dashboard, rejection/retry, disconnect and reload, plus the existing Task Account fixture flow. Deployment owner supplies protected Preview configuration and authorized Sepolia owner wallet; live purchase, hosted evidence, admin same-task audit and user acceptance require separate proof. Do not infer those outcomes from this report.

AI proposal handling: adopted the bounded official Scaffold-ETH 2 wallet provider pattern, modified it to preserve Floww's encrypted BFF SIWE and Task Account authority, and rejected burner wallets, sample contracts and automatic signatures because they conflict with selected-purchase approval.
