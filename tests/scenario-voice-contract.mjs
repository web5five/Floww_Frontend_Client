import assert from 'node:assert/strict';
import { stageVoiceIntent, consumeVoiceIntent, voiceScenarioAvailability } from '../src/lib/voice/confirmed-intent.ts';

const owner = '0x' + '11'.repeat(20);
const other = '0x' + '22'.repeat(20);
const taskId = '11111111-2222-4333-8444-555555555555';
const otherTask = '11111111-2222-4333-8444-666666666666';
const nonce = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const now = Date.now();
const items = new Map();
const store = {
  getItem: key => items.get(key) ?? null,
  setItem: (key, value) => items.set(key, value),
  removeItem: key => items.delete(key),
};
const task = { taskId, status: 'AWAITING_APPROVAL', attempts: [], mandate: { expiresAt: new Date(now + 60000).toISOString() } };

assert.equal(voiceScenarioAvailability(task, owner, store, now), 'ready');
assert.equal(stageVoiceIntent(store, owner, taskId, 'permitted', now, nonce), nonce);
assert.equal(consumeVoiceIntent(store, owner, taskId, 'permitted', nonce, now), true);
assert.equal(consumeVoiceIntent(store, owner, taskId, 'permitted', nonce, now), false, 'reload cannot replay in this tab');

for (const mismatch of [
  () => consumeVoiceIntent(store, other, taskId, 'permitted', nonce, now),
  () => consumeVoiceIntent(store, owner, otherTask, 'permitted', nonce, now),
  () => consumeVoiceIntent(store, owner, taskId, 'recipient', nonce, now),
  () => consumeVoiceIntent(store, owner, taskId, 'permitted', 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee', now),
  () => consumeVoiceIntent(store, owner, taskId, 'permitted', nonce, now + 120001),
]) {
  stageVoiceIntent(store, owner, taskId, 'permitted', now, nonce);
  assert.equal(mismatch(), false);
}

items.set(`floww-task-stop:${taskId}`, '1');
assert.equal(voiceScenarioAvailability(task, owner, store, now), 'stopped');
items.clear();
assert.equal(voiceScenarioAvailability({ ...task, attempts: [{ attemptId: 'existing' }] }, owner, store, now), 'decided');
assert.equal(voiceScenarioAvailability({ ...task, status: 'DECLINED' }, owner, store, now), 'stopped');
assert.equal(voiceScenarioAvailability({ ...task, mandate: { expiresAt: new Date(now - 1).toISOString() } }, owner, store, now), 'expired');
items.set(`floww-scenario-quote-request:${owner}:${taskId}`, '1');
assert.equal(voiceScenarioAvailability(task, owner, store, now), 'uncertain');
items.clear();
items.set(`floww-scenario-decision:${owner}:${taskId}`, '1');
assert.equal(voiceScenarioAvailability(task, owner, store, now), 'uncertain');
console.log('Voice intent one-use, scope, expiry, stop and existing-decision gates passed (local helper contract)');
