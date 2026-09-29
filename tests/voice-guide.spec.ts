import { test, expect } from "@playwright/test";

async function voiceFixture(page: import("@playwright/test").Page, ready = true) {
  await page.route("**/api/voice-guide", route => route.fulfill({ json: { ready, src: ready ? "/audio/floww-intro-ko.mp3" : null } }));
  await page.addInitScript(() => {
    const state = { calls: 0, pauses: 0, fail: false };
    Object.assign(window, { voiceTest: state });
    HTMLMediaElement.prototype.play = function () { state.calls++; return state.fail ? Promise.reject(new Error("Playback denied")) : Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { state.pauses++; };
  });
}
test("recorded narration is opt-in, stops and never requests paid generation", async ({ page }) => {
  await voiceFixture(page);
  const posts: string[] = []; page.on("request", r => { if (r.method() === "POST") posts.push(r.url()); });
  await page.goto("/pharmacy");
  const stats = () => page.evaluate(() => (window as unknown as { voiceTest: { calls: number; pauses: number } }).voiceTest);
  await expect(page.getByRole("button", { name: "한국어 안내 듣기" })).toBeEnabled();
  expect((await stats()).calls).toBe(0);
  await page.getByRole("button", { name: "한국어 안내 듣기" }).click();
  await expect(page.getByText("한국어 안내 재생 중", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "음성 안내 중지" }).click();
  expect((await stats()).calls).toBe(1);
  const pauses = (await stats()).pauses;
  await page.getByRole("button", { name: "한국어 안내 듣기" }).click();
  await page.getByRole("link", { name: "Floww 홈" }).click();
  await expect(page).toHaveURL("/");
  expect((await stats()).pauses).toBeGreaterThan(pauses);
  expect(posts).toEqual([]);
});
test("missing ElevenLabs recording remains unavailable with a transcript", async ({ page }) => {
  await voiceFixture(page, false);
  await page.goto("/pharmacy");
  await expect(page.getByRole("button", { name: "한국어 안내 듣기" })).toBeDisabled();
  const guide = page.getByRole("region", { name: "Floww 음성 안내" });
  await guide.getByText("안내 대본 보기", { exact: true }).click();
  await expect(guide.getByText(/^플로우에 오신 것을 환영합니다/)).toBeVisible();
  await expect(guide.getByText(/ElevenLabs 음성 준비 중/)).toBeVisible();
});
test("playback failure recovers and disclosures retain required evidence", async ({ page }) => {
  await voiceFixture(page);
  await page.goto("/pharmacy");
  await page.evaluate(() => { (window as unknown as { voiceTest: { fail: boolean } }).voiceTest.fail = true; });
  await page.getByRole("button", { name: "한국어 안내 듣기" }).click();
  await expect(page.getByText(/음성을 재생하지 못했어요/)).toBeVisible();
  await expect(page.getByRole("button", { name: "한국어 안내 듣기" })).toBeEnabled();
  const evidence = page.locator("#pharmacy-evidence");
  await expect(evidence.locator(".evidence-grid")).not.toBeVisible();
  await evidence.locator("summary").click();
  await expect(evidence.locator(".evidence-item")).toHaveCount(13);
  await expect(evidence.locator(".evidence-grid")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
