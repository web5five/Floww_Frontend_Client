import assert from 'node:assert/strict';
import { closeVoiceResources, connectionMessage, releaseVoiceResources } from '../src/lib/voice/client-session.ts';

const calls = [];
const active = {
  abort: new AbortController(),
  microphone: { getTracks: () => [{stop: () => calls.push('track-1')}, {stop: () => calls.push('track-2')}] },
  channel: {readyState:'open',close: () => calls.push('channel')},
  peer: {close: () => calls.push('peer')},
  audio: {pause: () => calls.push('audio'), srcObject: {}} ,
  timer: setTimeout(() => calls.push('timer-fired'), 1000),
};
releaseVoiceResources(active);
releaseVoiceResources(active);
assert.equal(active.abort.signal.aborted,true);
assert.deepEqual(calls,['track-1','track-2','channel','peer','audio']);
assert.equal(active.audio.srcObject,null);
const gracefulChannel = new EventTarget(); gracefulChannel.readyState = 'open';
gracefulChannel.send = value => { calls.push(value); queueMicrotask(() => gracefulChannel.dispatchEvent(new MessageEvent('message',{data:'{"type":"session.closed"}'}))); };
gracefulChannel.close = () => calls.push('graceful-channel-close');
const graceful = { abort:new AbortController(), microphone:{getTracks:()=>[{stop:()=>calls.push('graceful-track')}]}, channel:gracefulChannel, peer:{close:()=>calls.push('graceful-peer')} };
await closeVoiceResources(graceful);
assert.equal(JSON.parse(calls.find(value => typeof value === 'string' && value.startsWith('{'))).type,'session.close');
assert.ok(calls.indexOf('graceful-track') < calls.indexOf('graceful-peer'));
assert.ok(calls.includes('graceful-channel-close'));
assert.match(connectionMessage(new DOMException('denied','NotAllowedError')),/마이크 권한/);
assert.match(connectionMessage(new Error('THROTTLED')),/잠시 기다린/);
assert.match(connectionMessage(new Error('CONNECT')),/다시 시도/);
console.log('Voice resource release and microphone retry messages passed');
