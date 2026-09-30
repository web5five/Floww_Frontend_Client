import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = mkdtempSync(join(tmpdir(), 'floww-voice-disabled-'));
const script = new URL('../scripts/generate-voice.mjs', import.meta.url).href;
try {
  for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
    const env = { ...process.env, ELEVENLABS_API_KEY: 'fixture-key', ELEVENLABS_VOICE_ID: 'fixture-voice' };
    if (flag === undefined) delete env.FLOWW_VOICE_ENABLED;
    else env.FLOWW_VOICE_ENABLED = flag;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      let calls = 0;
      globalThis.fetch = async () => { calls++; throw new Error('Unexpected outbound request'); };
      process.on('exit', () => console.log('outbound=' + calls));
      await import(${JSON.stringify(script)});
    `], { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Voice generation is disabled\. No request sent\./);
    assert.equal(result.stdout.trim(), 'outbound=0');
  }
  console.log('ElevenLabs default-off and invalid-flag cases made zero outbound requests with configured fixture credentials');
} finally { rmSync(cwd, { recursive: true, force: true }); }
