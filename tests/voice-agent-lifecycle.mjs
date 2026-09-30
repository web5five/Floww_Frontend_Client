import assert from 'node:assert/strict';
import { closeVoiceResources, connectionMessage, releaseVoiceResources, updateVoiceTranscript, voiceScope } from '../src/lib/voice/client-session.ts';

const calls = [];
const active = {
  abort: new AbortController(),
  microphone: { getTracks: () => [{stop: () => calls.push('track-1')}, {stop: () => calls.push('track-2')}] },
  channel: {readyState:'open',close: () => calls.push('channel')},
  peer: {close: () => calls.push('peer')},
  audio: {pause: () => calls.push('audio'), srcObject: {}} ,
  timer: setTimeout(() => calls.push('timer-fired'), 1000),
  setupTimer: setTimeout(() => calls.push('setup-timer-fired'), 1000),
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
await new Promise(resolve => setTimeout(resolve, 1100));
assert.equal(calls.includes('timer-fired') || calls.includes('setup-timer-fired'), false);
assert.match(connectionMessage(new DOMException('denied','NotAllowedError')),/마이크 권한/);
assert.match(connectionMessage(new Error('THROTTLED')),/잠시 기다린/);
assert.match(connectionMessage(new Error('CONNECT')),/다시 시도/);
assert.match(connectionMessage(new Error('TASK')),/작업/);
assert.match(connectionMessage(new DOMException('denied','NotAllowedError'), 'en'),/microphone access/i);
assert.match(connectionMessage(new Error('THROTTLED'), 'en'),/wait a moment/i);
assert.match(connectionMessage(new Error('TASK'), 'en'),/task/i);
const taskId = '11111111-1111-4111-8111-111111111111';
const owner = `0x${'1'.repeat(40)}`;
const session = {identity:{address:owner},chainId:'11155111',expiresAt:new Date(Date.now()+60000).toISOString()};
const connection = {address:owner,chainId:'0xaa36a7'};
assert.ok(voiceScope(session,connection,taskId));
assert.equal(voiceScope(session,{...connection,chainId:'bad'},taskId),null);
assert.equal(voiceScope({...session,chainId:'not-a-chain'},connection,taskId),null);
assert.equal(voiceScope({...session,expiresAt:new Date(Date.now()-1000).toISOString()},connection,taskId),null);
assert.equal(voiceScope(session,{...connection,address:`0x${'2'.repeat(40)}`},taskId),null);
assert.equal(voiceScope(session,connection,'bad-task'),null);
assert.equal(voiceScope(null,connection,taskId),null);
let lines = [];
const firstDelta = {type:'conversation.item.input_audio_transcription.delta',item_id:'input-1',event_id:'delta-1',delta:'현재 '};
lines = updateVoiceTranscript(lines, firstDelta);
lines = updateVoiceTranscript(lines, firstDelta);
lines = updateVoiceTranscript(lines, {type:'conversation.item.input_audio_transcription.delta',item_id:'input-1',event_id:'delta-2',delta:'작업은?'});
assert.equal(lines[0].text,'현재 작업은?');
assert.equal(lines[0].partial,true);
lines = updateVoiceTranscript(lines, {type:'conversation.item.input_audio_transcription.completed',item_id:'input-1',transcript:'현재 작업은 어떤 상태인가요?'});
const afterFinal = lines;
assert.equal(updateVoiceTranscript(lines,firstDelta),afterFinal);
assert.equal(updateVoiceTranscript(lines,{type:'conversation.item.input_audio_transcription.completed',item_id:'input-1',transcript:'중복'}),afterFinal);
lines = updateVoiceTranscript(lines, {type:'response.output_audio_transcript.delta',item_id:'output-1',delta:'확인하고 '});
lines = updateVoiceTranscript(lines, {type:'response.output_audio_transcript.done',item_id:'output-1',transcript:'확인하고 있어요.'});
assert.deepEqual(lines.map(({speaker,text,partial}) => [speaker,text,partial]), [['you','현재 작업은 어떤 상태인가요?',false],['assistant','확인하고 있어요.',false]]);
assert.equal(updateVoiceTranscript(lines,{type:'response.output_item.done',item_id:'other'}),lines);
assert.equal(updateVoiceTranscript(lines,{type:'response.output_audio_transcript.delta',delta:'unbound'}),lines);
console.log('Voice resource release and microphone retry messages passed');
