// Run AFTER npm run build. Uses only a local synthetic backend and fixture credential.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const credential = 'production-fixture-not-a-real-token';
const calls = [];
const fixture = createServer(async (req, res) => {
  let body = ''; for await (const part of req) body += part;
  calls.push({ path: req.url, authorization: req.headers.authorization, body });
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/ai/drafts') res.end(JSON.stringify({ httpContractVersion: 'ai-draft-http.v1', status: 'NEEDS_CLARIFICATION', draft: null, issues: [{ code: 'FEES', field: 'maximumTotalCost', question: 'Include all fees?' }], evidence: null, error: null, reflected: credential }));
  else res.end(JSON.stringify({ status: 'UP' }));
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:3102';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3102'], { windowsHide: true, stdio: 'pipe', env: { ...process.env, FLOWW_API_BASE_URL: `http://127.0.0.1:${fixture.address().port}`, FLOWW_SERVER_DEV_TOKEN: credential } });
let serverOutput = '';
child.stdout.on('data', chunk => { serverOutput += chunk; });
child.stderr.on('data', chunk => { serverOutput += chunk; });
let browser;
try {
  let up = false;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${origin}/api/floww/actuator/health`)).ok) { up = true; break; } } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(up, 'Production fixture server failed to start');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const browserHeaders = [];
  page.on('request', req => browserHeaders.push(req.headers()));
  await page.goto(`${origin}/dashboard`);
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/floww/api/ai/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation: [{ role: 'user', content: 'Synthetic purchase conditions' }] }) });
    return { status: response.status, text: await response.text() };
  });
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.text).status, 'NEEDS_CLARIFICATION');
  assert.equal(result.text.includes(credential), false);
  assert.equal(browserHeaders.some(headers => !!headers.authorization), false);
  assert.ok(calls.some(call => call.path === '/api/ai/drafts' && call.authorization === `Bearer ${credential}`));
  const blocked = await fetch(`${origin}/api/floww/api/v1/tasks`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(blocked.status, 404);
  assert.equal((await page.content()).includes(credential), false);
  assert.equal(serverOutput.includes(credential), false);
  console.log('Production Next Route Handler: same-origin browser POST, server-only credential, response redaction, proposed-route rejection passed.');
} finally {
  await browser?.close();
  child.kill();
  fixture.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
}
