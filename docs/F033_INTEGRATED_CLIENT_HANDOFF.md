# F033 integrated client / 통합 클라이언트

Owner: Geondong Kim; implementation by parallel Orca sessions, integration and independent verification by the controller. Base: `b464fac8cd51dc2241a369b65292d711b706c93d`, refreshed on 2026-09-30 KST. This record supersedes the individual workers' unintegrated runtime claims. Confluence sync is pending; no external document edit is implied.

## Experience / 사용자 흐름

- Overview → wallet selection → Desktop/Mobile connection → explicit login signature → three scenario cards. The wallet toolkit is adapted from the pinned official Scaffold-ETH 2 source; see its license notice. Without a WalletConnect project ID, the mobile panel offers the page URL and does not invent a QR pairing session.
- Normal purchase fetches server quotes and requests the existing Kiln proposal. Budget and recipient cases send explicit user-selected policy probes. A policy result never authorizes payment. Purchase conditions are prominent; raw identifiers and audit data are expandable.
- `/pharmacy` and `/chat/<taskId>` share one persisted Task, with owner-scoped pending intents and unknown-response locks. Reload cannot resend an unknown create/proposal. STOP immediately disables continuation and requests the server stop; it does not undo already submitted transactions.
- The chat microphone opens the same panel as `/voice?taskId=<taskId>`. Start explicitly requests microphone access; opening the panel does not. It shows listening/speaking, transcripts, mute, end and retry. Closing, navigation, identity changes and session expiry release audio resources.
- Voice accepts only a fixed scenario intent and requires **화면에서 계속**. The current Task and owner are retained. Existing Kiln decisions, deterministic policy and wallet approval remain the purchase authority.

위 흐름은 같은 Task를 화면·채팅·음성에서 이어갑니다. 음성으로 결제나 지갑 승인을 실행하지 않습니다. 재시도는 결과가 불명확한 구매 요청을 자동으로 다시 보내는 기능이 아닙니다.

## Environment / 실행 설정

- Use the pinned Node 24 runtime, `npm ci`, `npm run build`, then `npm start`.
- Configure the existing team wallet auth and `FLOWW_API_BASE_URL` as in `.env.example`. A protected backend may use the existing server-only `FLOWW_SERVER_VERCEL_BYPASS_SECRET`; it is never a browser header or query parameter.
- Voice: `OPENAI_API_KEY` and optional `OPENAI_REALTIME_MODEL=gpt-realtime-mini`, server only. A user-authenticated team session is mandatory; no shared development JWT or anonymous voice fallback exists.
- Optional `NEXT_PUBLIC_FLOWW_ADMIN_AUDIT_URL` must be an HTTPS template containing `{taskId}`. Admin requires a separate ADMIN audience/role account. The client does not promote a USER.
- The three-minute client timer and per-process start throttle are not hard account-wide billing caps. Shared rate/spend limits and actual microphone acceptance are deployment follow-ups.

## Verification / 검증 범위

- Controller production build, lint and TypeScript checks run on the combined source. Desktop/mobile browser fixtures cover wallet failure/recovery, exact authorization and amounts, same-Task navigation, DENY with no payment, STOP, unknown-result reload and completion evidence.
- Node 24.19.0: `npm run build`, `npm run lint`, `npm run typecheck` passed. Playwright desktop/mobile checks passed **88/88** (70 integrated journey/wallet/voice checks plus 18 existing proxy, pagination, amount and policy checks). `tests/voice-agent-contract.mjs` and `tests/voice-agent-lifecycle.mjs` passed separately. These are controller results; CI results are recorded by the linked PR.
- Voice component browser fixtures cover no recording before Start, microphone denial and retry, the Task ID on the session request, transcripts, explicit scenario confirmation, mute and teardown when closing.
- A real OpenAI WebRTC probe returned HTTP 201, connected the peer, received a remote audio track and the expected short transcript. It used synthetic local authentication and synthetic text input, with no human microphone or blockchain action. The permanent key was kept outside this repository and all browser bundles.
- This is not a new live wallet/Kiln/Sepolia/fulfillment E2E run or acceptance of the deployed client. Hosted settings, a real end-user microphone session and the final integrated purchase remain distinct checks. Existing backend evidence is not relabeled as a new frontend run.

검증용 브라우저 응답과 실제 OpenAI 연결 결과를 구분합니다. 사용자의 실제 마이크 입력, 배포된 전체 구매 흐름은 별도로 확인해야 합니다.
