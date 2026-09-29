# CLIENT-2: purchase studio, narration and account evidence

2026-09-30 KST · Frontend owner: Sinwoo · Implementation/review: Codex (not teammate approval).

The pharmacy screen now emphasizes comparable prices, policy conditions, selection and progress. Existing blue/yellow branding and readable text remain. Detailed authorization explanations and the 13-item evidence checklist are expandable. Local demos never imply live approval or payment.

## Contract update

New backend routes retain `/api/v1`; legacy execution/draft routes retain their existing `/api` paths. JSON event polling remains in place. Wallet-only client scope is unchanged.

Server [PR #41](https://github.com/web5five/Floww_Server/pull/41), merged at `6f1d3029885808bd35d706b47688b24166ed9273`, adds the Task Account execution contract. See its [API handoff](https://github.com/web5five/Floww_Server/blob/6f1d3029885808bd35d706b47688b24166ed9273/docs/TASKACCOUNT_E2E_KO_EN.md) and later [independent Sepolia evidence](https://github.com/web5five/Floww_Server/blob/6f1d3029885808bd35d706b47688b24166ed9273/docs/F031_INDEPENDENT_SEPOLIA.md). The latter records real public-chain payment with simulated pharmacy fulfillment, from a locally hosted backend. It does not certify this website or user-operated frontend acceptance.

The client now proxies **GET `/api/v1/tasks/{taskId}/account`** with the existing encrypted owner JWT session. The selected Task's account/payment/fulfillment fields are validated before display. Hash existence alone is not success. Both operation states, hashes and verification timestamps plus the Task/account completion states are required to display completion. Unknown outcomes remain pending. Explorer links use only validated hashes returned for that Task. Historical example transactions are not substituted.

Account mutations and wallet spending actions remain disabled in this client pending frontend integration/acceptance. They are implemented server APIs, not still proposals. The old client handoff's statement that the server schema mismatch blocks everything is superseded by PR #41; remaining work is the browser wallet sequence and deployed configuration. No backend/contract code was changed here.

## ElevenLabs narration

Narration uses a prerecorded asset, not paid generation on every play. No browser-native synthesized voice is presented as ElevenLabs. The browser only reads availability from GET `/api/voice-guide` and plays `/audio/floww-intro-ko.mp3`. Missing audio is visibly unavailable, with a transcript. Playback is opt-in and stops on navigation/backgrounding; playback errors restore usable controls. No microphone, voice cloning or chat feature is added.

To generate, configure your authorized ElevenLabs voice and key only in `.env.local`:

```dotenv
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

Then run `node scripts/generate-voice.mjs` once. This is a paid provider request when configured; it is never invoked by builds or user playback, never automatically retries and refuses to overwrite an existing recording. Review `src/lib/voice-script.json` first. The script uses the [official text-to-speech endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), `eleven_multilingual_v2`, and MP3 output. Review the generated audio before including it in a deployment. Alternatively place an authorized, reviewed ElevenLabs export at the same public path. Do not put keys into that file or any public variable.

No recording was generated during this update: the workspace has no ElevenLabs key/voice configuration. Running the generator confirmed it exits before any request when missing configuration. Playback tests use media fixtures and do not prove the quality of a generated voice.

## Boundaries and remaining work

Frontend: app presentation, player/transcript, server proxy, account response validation, evidence display and tests. Team backend: wallet JWT, Task/policy/Kiln/TaskAccount persistence, executor/reporter and public-chain verification. Deployment validation and a public accessible backend URL are still a separate handoff. Actual wallet spending, live account evidence from this browser, actual ElevenLabs generation/listening and public app deployment are not certified by these local tests.

Refs #2. Confluence PENDING_SYNC, target 12517414 (Atlassian connector unavailable). Private PDF/chat snapshots are not published.

## Validation

Local Windows Chrome: 18 purchase/rehearsal/voice cases passed on desktop/mobile, followed by 10 account-evidence and affected Task cases after the PR #41 addition (22 distinct cases overall, overlapping Task cases intentionally rerun). Next.js production build passed. No real wallet or live payment was initiated. Account/media responses in these tests are fixtures. Generator with missing credentials exited before any provider request.

`npm run lint` and `npm run typecheck` passed after resolving the cleanup-ref lint warning and the test's BigInt target syntax. Desktop/mobile page captures were inspected. The local availability endpoint correctly reports `ready:false` without a recording. The existing app remains at http://127.0.0.1:3001/pharmacy during this development session; this is not a public deployment URL.
