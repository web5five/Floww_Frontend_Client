export interface VoiceResources {
  peer?: Pick<RTCPeerConnection, "close">;
  channel?: Pick<RTCDataChannel, "close"> & { readyState: RTCDataChannelState };
  microphone?: Pick<MediaStream, "getTracks">;
  abort: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  audio?: Pick<HTMLAudioElement, "pause" | "srcObject">;
}

/** Idempotent release for End, owner/task changes, failed setup, and unmount. */
const released = new WeakSet<VoiceResources>();
export function releaseVoiceResources(active: VoiceResources | null) {
  if (!active || released.has(active)) return;
  released.add(active);
  clearTimeout(active.timer);
  active.abort.abort();
  active.microphone?.getTracks().forEach(track => track.stop());
  if (active.channel?.readyState !== "closed") active.channel?.close();
  active.peer?.close();
  if (active.audio) { active.audio.pause(); active.audio.srcObject = null; }
}

/** Best-effort graceful close, with an 800 ms upper bound before local teardown. */
export async function closeVoiceResources(active: VoiceResources | null): Promise<void> {
  if (!active) return;
  active.abort.abort();
  active.microphone?.getTracks().forEach(track => track.stop());
  const channel = active.channel as RTCDataChannel | undefined;
  if (channel?.readyState === "open") {
    const openChannel = channel;
    await new Promise<void>(resolve => {
      const timer = setTimeout(done, 800);
      function done() { clearTimeout(timer); openChannel.removeEventListener("message", receive); openChannel.removeEventListener("close", done); resolve(); }
      function receive(event: MessageEvent) { try { if (JSON.parse(event.data)?.type === "session.closed") done(); } catch { /* unrelated event */ } }
      openChannel.addEventListener("message", receive);
      openChannel.addEventListener("close", done);
      try { openChannel.send(JSON.stringify({ type: "session.close" })); } catch { done(); }
    });
  }
  releaseVoiceResources(active);
}

export function connectionMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return code === "AUTH" ? "로그인 상태를 확인한 뒤 다시 시작해 주세요."
    : code === "THROTTLED" ? "잠시 기다린 뒤 다시 시작해 주세요."
    : code === "UNSUPPORTED" ? "이 브라우저에서는 마이크 음성 대화를 사용할 수 없어요."
    : error instanceof DOMException && error.name === "NotAllowedError" ? "마이크 권한을 허용한 뒤 다시 시작해 주세요."
    : "음성 연결을 확인하지 못했어요. 다시 시도해 주세요.";
}
