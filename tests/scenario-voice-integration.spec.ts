import { expect, test, type Page } from '@playwright/test';
import type { TaskQuote, TaskView } from '../src/lib/api/task-types';

test.skip(process.env.NEXT_PUBLIC_FLOWW_VOICE_ENABLED !== 'true', 'Development voice UI opt-in is required; production default stays off.');

const owner = '0x1111111111111111111111111111111111111111';
const asset = { chainId: 11155111, tokenAddress: '0x2222222222222222222222222222222222222222', tokenDecimals: 6 };
const quotes: TaskQuote[] = ['a', 'b', 'c'].map((name, index) => ({ quoteId: `qt-${name}`, merchantId: `pharmacy-${name}`, merchantName: `약국 ${name.toUpperCase()}`, itemName: '처방 품목', totalAmountBaseUnits: ['23500000', '65000000', '18500000'][index], asset, recipientAddress: owner, quotedPayToAddress: owner, expiresAt: new Date(Date.now() + 3600000).toISOString(), evidenceMode: 'fixture' }));

async function fixture(page: Page) {
  const taskId = '11111111-2222-4333-8444-555555555555';
  const task: TaskView = { taskId, status: 'AWAITING_APPROVAL', statusReasonCode: null, goal: '처방 품목 구매', mandate: { mandateId: '66666666-7777-4888-8999-aaaaaaaaaaaa', version: 1, status: 'DRAFT', itemId: 'acetaminophen-500mg-10', maxAmountBaseUnits: '60000000', consumedBaseUnits: '0', remainingBaseUnits: '60000000', asset, expiresAt: new Date(Date.now() + 3600000).toISOString(), budgetScope: 'TASK_CUMULATIVE' }, attempts: [], updatedAt: new Date().toISOString(), completedAt: null };
  const posts: string[] = [];
  await page.addInitScript(({ owner }) => {
    const listeners = new Map<string, () => void>();
    const provider = { request: async ({ method }: { method: string }) => method === 'eth_chainId' ? '0xaa36a7' : [owner], on(name: string, listener: () => void) { listeners.set(name, listener); }, removeListener(name: string) { listeners.delete(name); } };
    Object.assign(window, { f052Disconnect: () => listeners.get('disconnect')?.() });
    window.addEventListener('eip6963:requestProvider', () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: 'f052-voice-fixture', name: 'MetaMask' }, provider } })));
  }, { owner });
  let readHold: Promise<void> | null = null, releaseRead = () => {}, heldReads = 0, returnedTaskId: string | null = null;
  await page.route('**/api/wallet-auth/*', route => route.fulfill({ json: route.request().url().endsWith('/config') ? { enabled: true, mode: 'team-jwt', businessReady: true } : { identity: { namespace: 'eip155', address: owner }, chainId: '11155111', expiresAt: new Date(Date.now() + 3600000).toISOString() } }));
  await page.route('**/api/voice/session**', route => { posts.push('/api/voice/session'); return route.fulfill({ status: 503, json: { reasonCode: 'VOICE_DISABLED' } }); });
  await page.route('**/api/tasks**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, parts = path.split('/').filter(Boolean);
    if (req.method() === 'POST') posts.push(path);
    if (readHold && req.method() === 'GET' && parts.length === 3) { heldReads++; await readHold; }
    if (parts.length === 2 && req.method() === 'POST') { expect(req.headers()['idempotency-key']).toBeTruthy(); return route.fulfill({ json: task }); }
    if (parts.length === 2) return route.fulfill({ json: [task] });
    if (parts.at(-1) === 'events') return route.fulfill({ json: { events: [], nextCursor: 0, hasMore: false } });
    if (req.method() === 'GET' && parts.length === 3) return route.fulfill({ json: returnedTaskId ? { ...task, taskId: returnedTaskId } : task });
    if (parts.at(-1) === 'quotes') return route.fulfill({ json: { taskId, mandateVersion: 1, quotes } });
    if (parts.at(-1) === 'ai-proposal' || parts.at(-1) === 'attempts') {
      const quote = parts.at(-1) === 'ai-proposal' ? quotes[0] : quotes.find(item => item.quoteId === req.postDataJSON().quoteId)!;
      const denied = quote.merchantId !== 'pharmacy-a';
      const attempt = { attemptId: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', mandateId: task.mandate.mandateId, mandateVersion: 1, quoteId: quote.quoteId, merchantId: quote.merchantId, status: denied ? 'BLOCKED' : 'POLICY_ALLOWED', amountBaseUnits: quote.totalAmountBaseUnits, recipientAddress: quote.recipientAddress, policy: { decision: denied ? 'DENY' : 'ALLOW', reasonCode: quote.merchantId === 'pharmacy-b' ? 'BUDGET_EXCEEDED' : quote.merchantId === 'pharmacy-c' ? 'RECIPIENT_NOT_ALLOWED' : null, message: null }, payment: { status: 'NOT_ATTEMPTED', txHash: null } };
      task.attempts = [attempt as TaskView['attempts'][number]];
      return route.fulfill({ json: parts.at(-1) === 'ai-proposal' ? { proposal: { status: 'PROPOSED' }, attempt, reusedAttempt: false } : attempt });
    }
    return route.fulfill({ json: task });
  });
  return { task, posts, setReturnedTaskId: (value: string | null) => { returnedTaskId = value; }, holdReads: () => { readHold = new Promise(resolve => { releaseRead = resolve; }); }, releaseReads: () => { releaseRead(); readHold = null; }, heldReads: () => heldReads };
}

async function signInFixture(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '지갑 선택', exact: true }).click();
  await page.getByRole('button', { name: /MetaMask.*감지됨/ }).click();
  await page.getByRole('button', { name: 'MetaMask 연결', exact: true }).click();
  await page.getByRole('link', { name: '구매 시나리오', exact: true }).click();
}

for (const [intent, label, decisionPath] of [
  ['permitted', '허용된 구매', '/ai-proposal'],
  ['over-budget', '예산 초과', '/attempts'],
  ['recipient', '수취인 조건', '/attempts'],
] as const) {
  test(`confirmed ${intent} voice request continues the same Task once`, async ({ page }, testInfo) => {
    const { task, posts } = await fixture(page);
    await signInFixture(page);
    await page.getByRole('button', { name: /^01 허용된 구매/ }).click();
    await expect(page).toHaveURL(new RegExp(`/journey/${task.taskId}/mandate`));
    await page.getByRole('link', { name: /음성 대화 열기/ }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/voice');
    expect(new URL(page.url()).searchParams.get('taskId')).toBe(task.taskId);
    expect(new URL(page.url()).searchParams.get('from')).toBe('mandate');
    await expect(page.getByRole('link', { name: /같은 작업으로 돌아가기/ })).toHaveAttribute('href', `/journey/${task.taskId}/mandate?scenario=permitted`);
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('group', { name: '시나리오 요청 확인' })).toBeVisible();
    await page.screenshot({ path: `artifacts/f052-voice-${intent}-${testInfo.project.name}.png`, fullPage: true });
    if (intent === 'recipient' && testInfo.project.name === 'mobile') {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.screenshot({ path: 'artifacts/f052-voice-recipient-mobile-320.png', fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(posts).toEqual(['/api/tasks']); // Intent and model output alone do not write.
    await page.getByRole('button', { name: '화면에서 계속' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/chat/${task.taskId}`);
    expect(new URL(page.url()).searchParams.get('scenario')).toBe(intent);
    expect(new URL(page.url()).searchParams.get('voice')).toBeTruthy();
    await expect.poll(() => posts.filter(path => path.endsWith(decisionPath)).length).toBe(1);
    expect(posts.filter(path => path === '/api/tasks')).toHaveLength(1);
    expect(posts.filter(path => path.endsWith('/quotes'))).toHaveLength(1);
    expect(posts.filter(path => /payment|orders|approval|voice\/session/.test(path))).toHaveLength(0);
    const before = [...posts];
    await page.reload();
    await expect(page.locator('#scenario-progress')).toBeVisible();
    expect(posts).toEqual(before);
    const returnLink = page.getByRole('link', { name: /시나리오 화면으로 돌아가기/ });
    await expect(returnLink).toHaveAttribute('href', new RegExp(`scenario=${intent}$`));
    await returnLink.click();
    await expect(page).toHaveURL(new RegExp(`/journey/${task.taskId}/(?:mandate|decision|approval|result)`));
    await expect(page.getByRole('link', { name: /음성 대화 열기/ })).toBeVisible();
    await page.screenshot({ path: `artifacts/f052-${intent}-${testInfo.project.name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('existing attempt and expired Task cannot start another voice check', async ({ page }) => {
  const { task, posts } = await fixture(page);
  await signInFixture(page);
  await page.getByRole('button', { name: /^01 허용된 구매/ }).click();
  await expect(page).toHaveURL(new RegExp(`/journey/${task.taskId}/mandate`));
  await page.getByRole('link', { name: /음성 대화 열기/ }).click();
  task.attempts = [{ attemptId: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', mandateId: task.mandate.mandateId, mandateVersion: 1, quoteId: quotes[0].quoteId, merchantId: quotes[0].merchantId, status: 'POLICY_ALLOWED', amountBaseUnits: quotes[0].totalAmountBaseUnits, recipientAddress: owner, policy: { decision: 'ALLOW', reasonCode: null, message: null }, payment: { status: 'NOT_ATTEMPTED', txHash: null } }];
  await page.getByRole('button', { name: '예산 초과', exact: true }).click();
  await page.getByRole('button', { name: '화면에서 계속' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('이미 판정됐어요');
  expect(posts).toEqual(['/api/tasks']);
  task.attempts = [];
  task.mandate.expiresAt = new Date(Date.now() - 1000).toISOString();
  await page.getByRole('button', { name: '예산 초과', exact: true }).click();
  await page.getByRole('button', { name: '화면에서 계속' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('기한이 지났어요');
  expect(posts).toEqual(['/api/tasks']);
});

test('English voice entry keeps the same Task and fits narrow screens', async ({ page }, testInfo) => {
  const { task, posts } = await fixture(page);
  await signInFixture(page);
  await page.getByRole('button', { name: /^01 허용된 구매/ }).click();
  await expect(page).toHaveURL(new RegExp(`/journey/${task.taskId}/mandate`));
  await page.getByRole('link', { name: /음성 대화 열기/ }).click();
  await page.getByRole('button', { name: '영어로 변경' }).click();
  await expect(page.getByRole('heading', { name: 'Continue this task by voice.' })).toBeVisible();
  await page.getByRole('button', { name: 'Over budget', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Confirm scenario request' })).toBeVisible();
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 720 });
  await page.screenshot({ path: `artifacts/f052-voice-english-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(posts).toEqual(['/api/tasks']);
  await page.getByRole('link', { name: 'Back to this Task' }).click();
  await expect(page).toHaveURL(new RegExp(`/journey/${task.taskId}/mandate`));
  expect(posts).toEqual(['/api/tasks']);
});

test('wallet disconnect during confirmation read cancels the pending voice action', async ({ page }) => {
  const { task, posts, holdReads, releaseReads, heldReads } = await fixture(page);
  await signInFixture(page);
  await page.getByRole('button', { name: /^01 허용된 구매/ }).click();
  await expect(page).toHaveURL(new RegExp(`/journey/${task.taskId}/mandate`));
  await page.getByRole('link', { name: /음성 대화 열기/ }).click();
  holdReads();
  await page.getByRole('button', { name: '예산 초과', exact: true }).click();
  await page.getByRole('button', { name: '화면에서 계속' }).click();
  await expect(page.getByRole('status').filter({ hasText: '같은 작업의 현재 상태' })).toBeVisible();
  await expect.poll(heldReads).toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as { f052Disconnect(): void }).f052Disconnect());
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  releaseReads();
  await page.waitForTimeout(200);
  expect(new URL(page.url()).pathname).toBe('/login');
  expect(posts).toEqual(['/api/tasks']);
  expect(await page.evaluate((id) => sessionStorage.getItem(`floww-voice-intent:${'0x' + '11'.repeat(20)}:${id}`), task.taskId)).toBeNull();
});

test('mismatched fetched Task ID cannot stage a voice intent or continue a journey', async ({ page }) => {
  const { task, posts, setReturnedTaskId } = await fixture(page);
  await signInFixture(page);
  await page.getByRole('button', { name: /^01 허용된 구매/ }).click();
  await expect(page).toHaveURL(new RegExp(`/journey/${task.taskId}/mandate`));
  await expect(page.getByRole('link', { name: /음성 대화 열기/ })).toBeVisible();
  setReturnedTaskId('11111111-2222-4333-8444-666666666666');
  await page.getByRole('link', { name: /음성 대화 열기/ }).click();
  await page.getByRole('button', { name: '예산 초과', exact: true }).click();
  await page.getByRole('button', { name: '화면에서 계속' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('상태를 확인하지 못했어요');
  expect(new URL(page.url()).pathname).toBe('/voice');
  expect(posts).toEqual(['/api/tasks']);
  await page.getByRole('link', { name: /같은 작업으로 돌아가기/ }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('다른 기록이 반환됐습니다');
  expect(posts).toEqual(['/api/tasks']);
});
