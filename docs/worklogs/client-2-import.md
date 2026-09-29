# CLIENT-2 frontend import

Date: 2026-09-30 KST. Owner: frontend contributor; implementation assistance: Codex.
Repository: web5five/Floww_Frontend_Client. Base: ed5bf93fef6dad3051611994f4f61fe9d233b03d.
Branch: feature/2-frontend-purchase-wallet-preview. Refs #2; this does not close full journey integration.

## Scope / 범위

Import the existing local Next.js client, API adapters and reproducible frontend tests. Preserve repository instructions and issue/PR templates. Add application CI and a public-safe runbook. No backend or contract changes.

기존 로컬 프런트 코드를 작업 브랜치로 옮기고 공통 지침·템플릿을 보존합니다. 실제 승인·결제·이행 전체 연동과 관리자 화면은 완료 범위가 아닙니다.

## Review and verification

The import excludes environment secrets, internal PDFs/chats, screenshots with local context, and the separate Java/PostgreSQL experimental checkouts. Local backend-stack scripts depending on those excluded checkouts are not shipped. Committed tests are frontend fixtures and standalone proxy checks.

Source checks distinguish mock policy approval from spending authorization; team JWT business access is disabled unless explicitly configured; local STOP is not remote cancellation. This is an agent review, not teammate approval. Backend/API and authorization owners still need to review final integration contracts.

Confluence: PENDING_SYNC, target workflow page 12517414. No live Confluence access or publication was performed. Prior shared documents are dated reference snapshots, not new agreement. No private source text is included.

## Remaining integration

## Actual local checks / 실제 로컬 검증

Verified in this clean target checkout on Windows with Node 24.19.0/npm 11.17.0:

- `npm ci --no-audit --no-fund`: passed. npm reported an ESLint deprecation and an unapproved optional resolver install-script warning; subsequent lint/build passed without enabling additional scripts.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3110 npm run test:e2e`: 83 passed, one initial desktop navigation timed out during cold development compilation. Targeted desktop backend-pagination rerun passed; all 84 cases have a passing result across these runs. No application-code changes were made to bypass the timeout.
- `node --conditions=react-server --experimental-strip-types tests/wallet-health.mjs`: passed.
- All 39 application source files match the original local client. Staged file review excludes .env.local/artifacts/PDFs and found no private-key/GitHub-token credential patterns. `git diff --cached --check` passed.
- Application CI is added, but remote CI is a separate result from these local checks. Local Next reports a harmless parent-lockfile warning because this checkout is nested for publication isolation.

기존 로컬 프런트와 소스가 동일한 별도 체크아웃에서 검사했습니다. 최초 개발 컴파일 시 탐색 시간 초과 1건은 준비된 서버에서 재실행해 통과했습니다. 실제 결제·이행·지갑 확장 프로그램을 검증한 결과가 아닙니다.

Final EIP-712 fields and verification, current mandate/version mapping, operational merchant quotes, protected business JWT ownership, deployed origins, transaction/receipt reconciliation and fulfillment verification remain external dependencies. Real wallet-extension acceptance and cloud deployment are not established by local browser fixtures.

No main merge, deployment, real payment or transaction submission is part of this task.
