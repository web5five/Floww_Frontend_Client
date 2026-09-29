import assert from 'node:assert/strict';
import { walletBackendHealth } from '../src/lib/auth/health.ts';
let calls=0, value={status:'UP',components:{private:'must not leak'}};
const original=globalThis.fetch;
globalThis.fetch=async(url,options)=>{calls++;assert.equal(new URL(url).pathname,'/actuator/health');assert.deepEqual(options.headers,{Accept:'application/json'});return Response.json(value);};
const req=(method='GET',query='')=>walletBackendHealth(new Request('http://localhost/api/wallet-auth/health'+query,{method}));
try {
 delete process.env.FLOWW_API_BASE_URL; assert.equal((await req()).status,503);
 process.env.FLOWW_API_BASE_URL='http://remote.test'; assert.equal((await req()).status,503);
 process.env.FLOWW_API_BASE_URL='https://backend.example';
 assert.equal((await req('POST')).status,404); assert.equal((await req('GET','?url=evil')).status,404); assert.equal(calls,0);
 assert.deepEqual(await (await req()).json(),{ready:true}); assert.equal(calls,1);
 value={status:'DOWN'}; assert.equal((await req()).status,503); assert.equal(calls,2);
 globalThis.fetch=async()=>{calls++;throw new Error('private infrastructure message');};
 const failed=await req(); assert.equal(failed.status,503); assert.deepEqual(await failed.json(),{reasonCode:'AUTH_UPSTREAM_UNAVAILABLE'});assert.equal(calls,3);
 console.log('health proxy configuration, response minimization and no-retry checks passed');
} finally {globalThis.fetch=original;}
