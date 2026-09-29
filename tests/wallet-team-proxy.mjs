// Contract fixture test: this is not evidence of real backend signature verification.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { walletAuthProxy } from '../src/lib/auth/server.ts';
import { proxy } from '../src/lib/api/proxy.ts';
import { sealSession } from '../src/lib/auth/team-session.ts';
const address = '0x' + '12'.repeat(20), nonce = randomBytes(24).toString('hex');
const origin = 'http://localhost:3103', calls = [];
const expiresAt = new Date(Date.now()+290000).toISOString();
const message = `${origin} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Floww\n\nURI: ${origin}\nVersion: 1\nChain ID: 11155111\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}\nExpiration Time: ${expiresAt}`;
const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({sub:'fixture-user',role:'USER',aud:['client'],exp:Math.floor(Date.now()/1000)+1700})).toString('base64url'),randomBytes(32).toString('base64url')].join('.');
const server = createServer(async(req,res)=>{
  let body=''; for await(const chunk of req) body+=chunk;
  calls.push({path:req.url,body:JSON.parse(body),auth:req.headers.authorization,bypass:req.headers['x-vercel-protection-bypass']});
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify(req.url.endsWith('/nonce') ? {nonce,message,expiresAt} : {accessToken:token,tokenType:'Bearer',expiresIn:1800,user:{userId:'fixture-user',role:'USER',wallets:[{address}]}}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const req=(action,body,cookie='',requestOrigin=origin)=>walletAuthProxy(new Request(origin+'/api/wallet-auth/'+action,{method:action==='session'?'GET':'POST',headers:{Origin:requestOrigin,Host:'localhost:3103','Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})}),action);
try {
  process.env.FLOWW_WALLET_AUTH_ENABLED='true'; process.env.FLOWW_WALLET_AUTH_MODE='team-jwt';
  process.env.FLOWW_API_BASE_URL=`http://127.0.0.1:${server.address().port}`;
  process.env.FLOWW_SERVER_VERCEL_BYPASS_SECRET='fixture-bypass';
  delete process.env.FLOWW_SESSION_SECRET;
  assert.equal((await req('session')).status,503);
  process.env.FLOWW_SESSION_SECRET=randomBytes(32).toString('hex');
  assert.equal((await req('challenge',{},'','https://other.test')).status,403);
  const challenge=await req('challenge',{address,chainId:'11155111'});
  assert.equal(challenge.status,200); assert.equal((await challenge.json()).format,'team-jwt');
  assert.equal(calls[0].body.chainId,11155111); assert.equal(calls[0].auth,undefined); assert.equal(calls[0].bypass,'fixture-bypass');
  assert.equal(challenge.headers.get('x-vercel-protection-bypass'),null);
  const proof={challengeId:nonce,message,signature:'0x'+'11'.repeat(65)};
  assert.equal((await req('verify',proof)).status,400);
  const verified=await req('verify',proof,`floww_wallet_challenge=${nonce}`);
  assert.equal(verified.status,200);
  const session=await verified.json(); assert.equal(session.identity.address,address);
  assert.equal(JSON.stringify(session).includes(token),false);
  assert.deepEqual(calls[1].body,{message,signature:proof.signature});
  assert.equal(calls[1].bypass,'fixture-bypass'); assert.equal(verified.headers.get('x-vercel-protection-bypass'),null);
  const cookie=verified.headers.getSetCookie().find(c=>c.startsWith('floww_wallet_session='));
  assert.match(cookie,/HttpOnly; SameSite=Strict/); assert.equal(cookie.includes(token),false);
  const pair=cookie.split(';')[0], count=calls.length;
  assert.deepEqual(await (await req('session',undefined,pair)).json(),session);
  assert.equal(calls.length,count); // No invented upstream /me endpoint.
  assert.equal(await (await req('session',undefined,pair+'; '+pair)).json(),null);
  assert.equal(await (await req('session',undefined,pair+'x')).json(),null);
  const expired=sealSession({...session,expiresAt:new Date(0).toISOString(),accessToken:token,userId:'fixture-user'});
  assert.equal(await (await req('session',undefined,'floww_wallet_session='+expired)).json(),null);
  process.env.FLOWW_SERVER_DEV_TOKEN='fixture-only'; delete process.env.FLOWW_BUSINESS_JWT_ENABLED;
  const blocked=await proxy(new Request(origin+'/api/floww/api/executions',{headers:{Cookie:pair}}),['api','executions']);
  assert.equal(blocked.status,503); assert.equal(calls.length,count);
  const logout=await req('logout',undefined,pair);
  assert.deepEqual(await logout.json(),{localLogout:true,serverRevocationAvailable:false});
  assert.equal(calls.length,count); assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  console.log('Team JWT proxy contract, cookie integrity, expiry, local logout and business gate passed');
} finally { server.closeAllConnections(); await new Promise(r=>server.close(r)); }
