# Submission voice gate — F051

The submission uses Kiln `qwen3-32b` for final product inference. An OpenAI/ElevenLabs voice exception has not been approved, so voice remains disabled. Existing voice implementation is retained for a separately approved future opt-in.

Set these exact values in every submission build/deployment:

```dotenv
FLOWW_VOICE_ENABLED=false
NEXT_PUBLIC_FLOWW_VOICE_ENABLED=false
```

`FLOWW_VOICE_ENABLED` is server-only. Only the exact string `true` enables the voice session endpoint and manual ElevenLabs generation. Missing, empty, false or malformed values block execution before provider requests, even if credentials remain. The endpoint returns `503`, `VOICE_DISABLED`, and `Cache-Control: no-store` without backend or provider fetches. The generator exits with no request. Removing unused provider credentials from the deployment remains appropriate but is not the enforcement mechanism.

`NEXT_PUBLIC_FLOWW_VOICE_ENABLED` is a public presentation flag frozen at Next.js build time. False hides the chat microphone and full voice link while retaining text language input and Task history. The `/voice` page also checks the server flag: disabled requests return to `/chat/<valid taskId>` or `/pharmacy`. To enable a separately approved environment, explicitly set both flags to `true`, configure authorized server credentials, and rebuild; a public flag alone cannot enable server inference.

Existing voice browser fixtures run only when `NEXT_PUBLIC_FLOWW_VOICE_ENABLED=true` is explicitly supplied to both the application build and test runner. Default CI exercises hidden microphone/link assertions and text input. The server contract fixture explicitly opts in only after verifying zero outbound requests for absent/invalid server flags with a configured fixture key. The ElevenLabs regression runs with configured fixture credentials in an isolated directory and verifies zero requests for each disabled flag.

Safe local checks:

```sh
npm run lint
npm run typecheck
node --conditions=react-server --experimental-strip-types tests/voice-agent-contract.mjs
node tests/voice-generation-disabled.mjs
node --experimental-strip-types tests/voice-agent-lifecycle.mjs
```

This record describes code and automated fixture boundaries. Hosted deployment/environment verification belongs to the release owner; no provider call or hosted browser acceptance is asserted here.
