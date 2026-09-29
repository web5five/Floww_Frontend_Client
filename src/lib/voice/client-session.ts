export interface VoiceResources {
  peer?: Pick<RTCPeerConnection, "close">;
  channel?: Pick<RTCDataChannel, "close"> & { readyState: RTCDataChannelState };
  microphone?: Pick<MediaStream, "getTracks">;
  abort: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  setupTimer?: ReturnType<typeof setTimeout>;
  audio?: Pick<HTMLAudioElement, "pause" | "srcObject">;
}

export type VoiceLine = { id: string; speaker: "you" | "assistant"; text: string; partial: boolean; eventIds?: string[] };

const taskIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const addressPattern = /^0x[0-9a-f]{40}$/i;

/** UI gate only. The session BFF still rechecks JWT ownership of the Task. */
export function voiceScope(session: { identity: { address: string }; chainId: string; expiresAt: string } | null | undefined, connection: { address: string; chainId: string } | null | undefined, taskId: string | undefined): string | null {
  if (!session || !connection || !taskId || !taskIdPattern.test(taskId)) return null;
  const owner = session.identity?.address;
  if (!addressPattern.test(owner) || !addressPattern.test(connection.address) || owner.toLowerCase() !== connection.address.toLowerCase()) return null;
  if (!/^\d+$/.test(session.chainId) || !/^(?:0x[0-9a-f]+|\d+)$/i.test(connection.chainId)) return null;
  try { if (BigInt(session.chainId) !== BigInt(connection.chainId)) return null; } catch { return null; }
  if (!(Date.parse(session.expiresAt) > Date.now())) return null;
  return `${owner.toLowerCase()}|${session.chainId}|${session.expiresAt}|${taskId.toLowerCase()}`;
}

/** Realtime deltas update one visible turn; completed events replace the provisional text. */
export function updateVoiceTranscript(lines: VoiceLine[], event: Record<string, unknown>): VoiceLine[] {
  const type = event.type;
  const input = type === "conversation.item.input_audio_transcription.delta" || type === "conversation.item.input_audio_transcription.completed";
  const output = type === "response.output_audio_transcript.delta" || type === "response.output_audio_transcript.done";
  if (!input && !output) return lines;
  const final = type === "conversation.item.input_audio_transcription.completed" || type === "response.output_audio_transcript.done";
  const text = final ? event.transcript : event.delta;
  if (typeof text !== "string" || !text.length) return lines;
  const speaker: VoiceLine["speaker"] = input ? "you" : "assistant";
  if (typeof event.item_id !== "string" || !event.item_id) return lines;
  const id = `${speaker}-${event.item_id}`;
  const existing = lines.find(line => line.id === id);
  if (existing && !existing.partial) return lines;
  const eventId = typeof event.event_id === "string" ? event.event_id : "";
  if (eventId && existing?.eventIds?.includes(eventId)) return lines;
  const next = (final ? text : `${existing?.text ?? ""}${text}`).slice(0, 1000);
  const updated: VoiceLine = { id, speaker, text: next, partial: !final, ...(eventId ? { eventIds: [...(existing?.eventIds ?? []), eventId].slice(-64) } : {}) };
  return existing ? lines.map(line => line.id === id ? updated : line) : [...lines, updated].slice(-12);
}

/** Idempotent release for End, owner/task changes, failed setup, and unmount. */
const released = new WeakSet<VoiceResources>();
export function releaseVoiceResources(active: VoiceResources | null) {
  if (!active || released.has(active)) return;
  released.add(active);
  clearTimeout(active.timer);
  clearTimeout(active.setupTimer);
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
    : code === "TASK" ? "이 작업을 확인하지 못했어요. 작업 화면에서 다시 확인해 주세요."
    : code === "CONFIG" ? "음성 연결이 준비되지 않았어요. 잠시 후 다시 시도해 주세요."
    : code === "UNSUPPORTED" ? "이 브라우저에서는 마이크 음성 대화를 사용할 수 없어요."
    : error instanceof DOMException && error.name === "NotAllowedError" ? "마이크 권한을 허용한 뒤 다시 시작해 주세요."
    : "음성 연결을 확인하지 못했어요. 다시 시도해 주세요.";
}
