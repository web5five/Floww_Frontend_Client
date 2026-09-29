import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sealSession } from '../src/lib/auth/team-session.ts';
import { createVoiceSession } from '../src/lib/voice/session-server.ts';
import { scenarioFromTool } from '../src/lib/voice/contract.ts';

const origin = 'http://localhost:3201';
const taskId = '1161d931-cbbd-4ff4-96e1-8b6fc22f274d';
const ownerId = 'aa61d931-cbbd-4ff4-96e1-8b6fc22f274d';
const address = '0x' + '12'.repeat(20);
const token = 'fixture.jwt.value';
const sdp = 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
process.env.FLOWW_WALLET_AUTH_ENABLED = 'true';
process.env.FLOWW_WALLET_AUTH_MODE = 'team-jwt';
process.env.FLOWW_BUSINESS_JWT_ENABLED = 'true';
process.env.FLOWW_SESSION_SECRET = randomBytes(32).toString('hex');
process.env.OPENAI_API_KEY = 'fixture-key-never-sent-to-browser';
process.env.FLOWW_API_BASE_URL = 'http://127.0.0.1:9000/';
const cookie = 'floww_wallet_session=' + sealSession({ userId: ownerId, accessToken: token, identity: { namespace: 'eip155', address }, chainId: '11155111', expiresAt: new Date(Date.now() + 600000).toISOString() });
let calls = [], backendOwner = ownerId, backendTask = taskId, backendStatus = 'ACTIVE';
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  if (String(url).includes('/api/v1/tasks/')) {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    return Response.json({ taskId: backendTask, ownerId: backendOwner, status: backendStatus, goal: 'private prescription contents', mandate: { maxAmountBaseUnits: '100000000', recipientAddress: address }, attempts: [{ policy: { decision: 'DENY' }, payment: { status: 'NOT_STARTED' } }] });
  }
  assert.equal(String(url), 'https://api.openai.com/v1/realtime/calls');
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Authorization, 'Bearer fixture-key-never-sent-to-browser');
  assert.match(options.headers['OpenAI-Safety-Identifier'], /^[a-f0-9]{64}$/);
  assert.notEqual(options.headers['OpenAI-Safety-Identifier'], ownerId);
  const session = JSON.parse(options.body.get('session'));
  assert.equal(options.body.get('sdp'), sdp);
  assert.equal(session.model, 'gpt-realtime-mini');
  assert.equal(session.max_output_tokens, 512);
  assert.equal(session.tools.length, 1);
  assert.deepEqual(session.tools[0].parameters.properties.intent.enum, ['permitted', 'over-budget', 'recipient']);
  assert.ok(session.instructions.includes('ACTIVE'));
  for (const forbidden of [token, address, 'private prescription', '100000000', 'fixture-key-never']) assert.equal(JSON.stringify(session).includes(forbidden), false);
  return new Response(sdp, { status: 201, headers: { 'Content-Type': 'application/sdp' } });
};
const request = (body = sdp, { requestOrigin = origin, requestCookie = cookie, query = '', type = 'application/sdp' } = {}) => new Request(`${origin}/api/voice/session${query}`, { method: 'POST', headers: { Host: 'localhost:3201', Origin: requestOrigin, Cookie: requestCookie, 'Content-Type': type }, body });
try {
  assert.equal((await createVoiceSession(request(sdp, {requestOrigin:'https://localhost:3201'}))).status,403);
  assert.equal((await createVoiceSession(request(sdp, {requestCookie:''}))).status,401);
  assert.equal((await createVoiceSession(request(sdp, {type:'text/plain'}))).status,415);
  assert.equal((await createVoiceSession(request(sdp, {query:'?model=arbitrary'}))).status,400);
  assert.equal((await createVoiceSession(request(sdp.repeat(400)))).status,413);
  const chunks = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(sdp)); controller.enqueue(new Uint8Array(17000)); controller.close(); } });
  const chunked = new Request(`${origin}/api/voice/session`, { method:'POST', headers:{Host:'localhost:3201',Origin:origin,Cookie:cookie,'Content-Type':'application/sdp'}, body:chunks, duplex:'half' });
  assert.equal((await createVoiceSession(chunked)).status,413);
  assert.equal(calls.length,0);
  backendOwner = 'bb61d931-cbbd-4ff4-96e1-8b6fc22f274d';
  assert.equal((await createVoiceSession(request(sdp, {query:`?taskId=${taskId}`}))).status,404);
  assert.equal(calls.length,1);
  backendOwner = ownerId; backendTask = 'cc61d931-cbbd-4ff4-96e1-8b6fc22f274d';
  assert.equal((await createVoiceSession(request(sdp, {query:`?taskId=${taskId}`}))).status,404);
  backendTask = taskId;
  const result = await createVoiceSession(request(sdp, {query:`?taskId=${taskId}`}));
  assert.equal(result.status,201); assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal(await result.text(),sdp);
  assert.equal(JSON.stringify([...result.headers]).includes(token),false);
  assert.equal((await createVoiceSession(request(sdp, {query:`?taskId=${taskId}`}))).status,429);
  assert.equal(calls.filter(call => call.url.includes('openai')).length,1);
  const otherCookie = 'floww_wallet_session=' + sealSession({ userId: 'dd61d931-cbbd-4ff4-96e1-8b6fc22f274d', accessToken: token, identity: { namespace: 'eip155', address }, chainId: '11155111', expiresAt: new Date(Date.now() + 600000).toISOString() });
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error('missing timeout')), 14000);
    options.signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(new Error('timeout')); }, { once: true });
  });
  assert.equal((await createVoiceSession(request(sdp, { requestCookie: otherCookie }))).status,502);
  assert.equal(scenarioFromTool({intent:'permitted'}),'permitted');
  assert.equal(scenarioFromTool({intent:'recipient'}),'recipient');
  for (const invalid of [{intent:'approve'}, {intent:'permitted',maxAmount:1}, {}, null, 'permitted']) assert.equal(scenarioFromTool(invalid),null);
  console.log('Voice auth, origin, body, owner context, secret exclusion, throttle and tool allowlist passed');
} finally { globalThis.fetch = originalFetch; }
