import { test, expect } from "@playwright/test";

const taskId = "11111111-1111-4111-8111-111111111111";
const owner = `0x${"1".repeat(40)}`;

test("chat microphone requires a click, recovers denial, retains task and releases on close", async ({ page }) => {
  const task = { taskId, status: "AWAITING_APPROVAL", statusReasonCode: null, goal: "처방 품목 구매", mandate: { mandateId: taskId, version: 1, status: "DRAFT", itemId: "acetaminophen-500mg-10", maxAmountBaseUnits: "60000000", consumedBaseUnits: "0", remainingBaseUnits: "60000000", asset: { tokenDecimals: 6, chainId: 11155111, tokenAddress: `0x${"2".repeat(40)}` }, expiresAt: new Date(Date.now() + 3600000).toISOString(), budgetScope: "TASK_CUMULATIVE" }, attempts: [], updatedAt: new Date().toISOString(), completedAt: null };
  const mutations: string[] = [], voiceRequests: string[] = [];
  await page.route("**/api/wallet-auth/*", route => route.fulfill({ json: route.request().url().endsWith("config") ? { enabled: true, mode: "team-jwt", businessReady: true } : { identity: { namespace: "eip155", address: owner }, chainId: "11155111", expiresAt: new Date(Date.now() + 600000).toISOString() } }));
  await page.route("**/api/tasks**", route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST") mutations.push(path);
    return route.fulfill({ json: path === "/api/tasks" ? [task] : path.endsWith("/events") ? { events: [], nextCursor: 0, hasMore: false } : task });
  });
  await page.route("**/api/voice/session?*", route => { voiceRequests.push(route.request().url()); return route.fulfill({ contentType: "application/sdp", body: "v=0\r\n" }); });
  await page.addInitScript(({ owner }) => {
    const state = { requests: 0, stops: 0, peersClosed: 0, enabled: true, channel: null as null | { onmessage?: (event: { data: string }) => void }, emit: (event: unknown) => state.channel?.onmessage?.({ data: JSON.stringify(event) }) };
    Object.assign(window, { voiceFixture: state });
    const provider = { request: async ({ method }: { method: string }) => method === "eth_chainId" ? "0xaa36a7" : [owner], on() {}, removeListener() {} };
    window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "voice-fixture", name: "Voice Fixture" }, provider } })));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      if (++state.requests === 1) throw new DOMException("Denied", "NotAllowedError");
      const track = { get enabled() { return state.enabled; }, set enabled(value: boolean) { state.enabled = value; }, stop() { state.stops++; } };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    } });
    class Peer {
      connectionState = "new";
      localDescription = { sdp: "v=0\r\n" };
      channel = { readyState: "open", onopen: () => {}, onmessage: (event: { data: string }) => { void event; }, close() {}, send() {} };
      addTrack() {}
      createDataChannel() { state.channel = this.channel; return this.channel; }
      async createOffer() { return { type: "offer", sdp: "v=0\r\n" }; }
      async setLocalDescription() {}
      async setRemoteDescription() { this.connectionState = "connected"; this.channel.onopen(); }
      close() { state.peersClosed++; }
    }
    Object.assign(window, { RTCPeerConnection: Peer });
  }, { owner });
  await page.goto("/login");
  await page.getByRole("button", { name: "지갑 선택", exact: true }).click();
  await page.getByRole("button", { name: /Voice Fixture.*감지됨/ }).click();
  await page.getByRole("button", { name: "Voice Fixture 연결", exact: true }).click();
  await page.getByRole("link", { name: "내 작업", exact: true }).click();
  await page.getByText("내 작업 다시 열기", { exact: true }).click();
  await page.getByRole("button", { name: "내 작업 조회", exact: true }).click();
  await page.locator(`a[href="/chat/${taskId}"]`).click();
  await page.getByRole("button", { name: "음성 대화 열기" }).click();
  const panel = page.getByRole("region", { name: "Floww 음성 대화", exact: true });
  const snapshot = () => page.evaluate(() => {
    const value = (window as unknown as { voiceFixture: { requests: number; stops: number; peersClosed: number; enabled: boolean } }).voiceFixture;
    return { requests: value.requests, stops: value.stops, peersClosed: value.peersClosed, enabled: value.enabled };
  });
  expect((await snapshot()).requests).toBe(0);
  await panel.getByRole("button", { name: "음성 대화 시작", exact: true }).click();
  await expect(panel).toContainText("마이크 권한");
  await panel.getByRole("button", { name: "다시 시작", exact: true }).click();
  await expect(panel).toContainText("듣는 중");
  expect(voiceRequests).toHaveLength(1);
  expect(new URL(voiceRequests[0]).searchParams.get("taskId")).toBe(taskId);
  await page.evaluate(() => {
    const fixture = (window as unknown as { voiceFixture: { emit: (event: unknown) => void } }).voiceFixture;
    fixture.emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "user-1", transcript: "현재 작업을 알려줘" });
    fixture.emit({ type: "response.output_audio_transcript.done", item_id: "reply-1", transcript: "구매 조건을 확인하고 있어요." });
    fixture.emit({ type: "response.output_item.done", item: { type: "function_call", name: "request_scenario", arguments: JSON.stringify({ intent: "over-budget" }), call_id: "call-1" } });
  });
  await expect(panel).toContainText("현재 작업을 알려줘");
  await expect(panel).toContainText("구매 조건을 확인하고 있어요.");
  await expect(panel.getByRole("group", { name: "시나리오 요청 확인" })).toBeVisible();
  expect(mutations).toEqual([]);
  await panel.getByRole("button", { name: "마이크 음소거", exact: true }).click();
  expect((await snapshot()).enabled).toBe(false);
  await page.getByRole("button", { name: "음성 대화 닫기" }).click();
  await expect(panel).toHaveCount(0);
  expect(await snapshot()).toEqual({ requests: 2, stops: 1, peersClosed: 1, enabled: false });
  expect(mutations).toEqual([]);
  await page.getByRole("button", { name: "음성 대화 열기" }).click();
  await expect(page.getByRole("group", { name: "시나리오 요청 확인" })).toHaveCount(0);
  expect((await snapshot()).requests).toBe(2);
});
