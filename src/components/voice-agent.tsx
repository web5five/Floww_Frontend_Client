"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWallet } from "./wallet-provider";
import { scenarioFromTool, type ScenarioIntent } from "@/lib/voice/contract";
import { closeVoiceResources, connectionMessage, releaseVoiceResources, updateVoiceTranscript, voiceScope, type VoiceLine, type VoiceResources } from "@/lib/voice/client-session";
import styles from "./voice-agent.module.css";

type Phase = "idle" | "connecting" | "listening" | "speaking" | "reconnecting" | "error";
type Live = VoiceResources & { peer?: RTCPeerConnection; channel?: RTCDataChannel; microphone?: MediaStream; audio?: HTMLAudioElement };
const labels: Record<Phase, string> = { idle: "대기 중", connecting: "마이크 연결 중", listening: "듣는 중", speaking: "답변 중", reconnecting: "연결이 끊어졌어요", error: "연결할 수 없어요" };
const intentLabels: Record<ScenarioIntent, string> = { permitted: "허용된 구매", "over-budget": "예산 초과", recipient: "수취인 조건" };

export function VoiceAgent({ taskId, onScenarioRequest }: { taskId?: string; onScenarioRequest?: (intent: ScenarioIntent) => void }) {
  const { auth, connection } = useWallet();
  const sessionExpiry = auth.session?.expiresAt ?? "";
  const scope = voiceScope(auth.session, connection, taskId);
  const authorized = scope !== null;
  const [phase, setPhase] = useState<Phase>("idle"), [muted, setMuted] = useState(false);
  const [message, setMessage] = useState("시작을 누르면 마이크 권한을 요청해요."), [lines, setLines] = useState<VoiceLine[]>([]);
  const [transcriptScope, setTranscriptScope] = useState("");
  const [pending, setPending] = useState<{ intent: ScenarioIntent; generation: number; scope: string } | null>(null);
  const live = useRef<Live | null>(null), serial = useRef(0);
  const latestScope = useRef(scope);
  useLayoutEffect(() => { latestScope.current = scope; }, [scope]);
  const visibleLines = authorized && transcriptScope === scope ? lines : [];
  const activePhase = ["connecting", "listening", "speaking"].includes(phase);

  const end = useCallback((notice = "음성 대화를 종료했어요.", graceful = false) => {
    serial.current++;
    const active = live.current; live.current = null;
    if (graceful) void closeVoiceResources(active); else releaseVoiceResources(active);
    setPending(null); setMuted(false); setPhase("idle"); setMessage(notice);
  }, []);

  useEffect(() => () => { serial.current++; const active = live.current; live.current = null; releaseVoiceResources(active); }, []);
  useEffect(() => { if (live.current) end("로그인 또는 작업이 바뀌어 대화를 종료했어요."); }, [scope, end]);

  async function start() {
    if (!scope || voiceScope(auth.session, connection, taskId) !== scope || live.current) return;
    const startedScope = scope;
    const generation = ++serial.current;
    const sameSession = () => generation === serial.current && live.current === active;
    const current = () => sameSession() && latestScope.current === startedScope && Date.parse(sessionExpiry) > Date.now();
    const active: Live = { abort: new AbortController() };
    live.current = active; setPhase("connecting"); setMessage("마이크 권한을 확인하고 있어요."); setLines([]); setTranscriptScope(startedScope); setPending(null);
    active.timer = setTimeout(() => { if (sameSession()) end("대화를 마쳤어요. 계속하려면 다시 시작해 주세요."); }, Math.max(0, Math.min(180000, Date.parse(sessionExpiry) - Date.now())));
    active.setupTimer = setTimeout(() => { if (current()) { end("음성 연결 시간이 초과됐어요. 다시 시도해 주세요."); setPhase("error"); } }, 25000);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") throw new Error("UNSUPPORTED");
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!current()) { microphone.getTracks().forEach(track => track.stop()); return; }
      active.microphone = microphone;
      microphone.getAudioTracks().forEach(track => {
        track.addEventListener("ended", () => { if (current()) { end("마이크 연결이 종료됐어요. 마이크를 확인한 뒤 다시 시작해 주세요."); setPhase("error"); } }, { once: true });
      });
      const peer = new RTCPeerConnection(); active.peer = peer;
      const audio = new Audio(); audio.autoplay = true; active.audio = audio;
      peer.ontrack = event => { if (!current()) return; audio.srcObject = event.streams[0] ?? new MediaStream([event.track]); void audio.play().catch(() => { if (current()) setMessage("소리가 들리지 않으면 브라우저의 오디오 재생을 허용해 주세요."); }); };
      peer.onconnectionstatechange = () => { if (!current()) return; if (["disconnected", "failed"].includes(peer.connectionState)) { end("연결이 끊어졌어요. 다시 시작해 주세요."); setPhase("reconnecting"); } };
      microphone.getAudioTracks().forEach(track => peer.addTrack(track, microphone));
      const channel = peer.createDataChannel("oai-events"); active.channel = channel;
      channel.onopen = () => { if (current()) { setPhase("listening"); setMessage("말씀해 주세요. 결제나 지갑 승인은 음성으로 실행되지 않아요."); } };
      channel.onclose = () => { if (current()) { end("연결이 끊어졌어요. 다시 시작해 주세요."); setPhase("reconnecting"); } };
      channel.onmessage = ({ data }) => {
        if (!current() || typeof data !== "string" || data.length > 32768) return;
        let event: Record<string, unknown>;
        try { event = JSON.parse(data); } catch { return; }
        if (event.type === "error") { end("음성 연결을 확인하지 못했어요. 다시 시도해 주세요."); setPhase("error"); return; }
        if (event.type === "session.closed") { end("음성 대화를 종료했어요."); return; }
        if (event.type === "input_audio_buffer.speech_started") setPhase("listening");
        if (event.type === "response.output_audio_transcript.delta" || event.type === "response.output_audio.delta") setPhase("speaking");
        if (event.type === "response.done") setPhase("listening");
        setLines(previous => updateVoiceTranscript(previous, event));
        if (event.type === "response.output_item.done") {
          const item = event.item;
          if (!item || typeof item !== "object" || Array.isArray(item)) return;
          const call = item as { type?: unknown; name?: unknown; arguments?: unknown; call_id?: unknown };
          if (call.type !== "function_call" || call.name !== "request_scenario" || typeof call.arguments !== "string" || call.arguments.length > 512) return;
          let intent: ScenarioIntent | null = null;
          try { intent = scenarioFromTool(JSON.parse(call.arguments)); } catch { /* invalid tool arguments */ }
          if (intent) { setPending({ intent, generation, scope: startedScope }); setMessage("화면에서 시나리오 요청을 확인해 주세요."); }
          if (typeof call.call_id === "string" && call.call_id.length < 128 && channel.readyState === "open") {
            channel.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output: intent ? "Confirmation is required in the Floww UI; no action has run." : "Invalid scenario intent. No action has run." } }));
            channel.send(JSON.stringify({ type: "response.create" }));
          }
        }
      };
      const offer = await peer.createOffer(); if (!current()) return;
      await peer.setLocalDescription(offer); if (!current()) return;
      const offerSdp = peer.localDescription?.sdp;
      if (!offerSdp) throw new Error("SDP");
      const url = taskId ? `/api/voice/session?taskId=${encodeURIComponent(taskId)}` : "/api/voice/session";
      const result = await fetch(url, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offerSdp, cache: "no-store", signal: active.abort.signal });
      if (!current()) return;
      if (!result.ok) throw new Error(result.status === 429 ? "THROTTLED" : result.status === 401 ? "AUTH" : result.status === 404 ? "TASK" : result.status === 503 ? "CONFIG" : "CONNECT");
      const answer = await result.text(); if (!current()) return;
      if (!answer.startsWith("v=0\r\n")) throw new Error("SDP");
      await peer.setRemoteDescription({ type: "answer", sdp: answer }); if (!current()) return;
      clearTimeout(active.setupTimer); active.setupTimer = undefined;
    } catch (error) {
      if (!current()) return;
      end(connectionMessage(error));
      setPhase("error");
    }
  }

  function toggleMute() { const next = !muted; live.current?.microphone?.getAudioTracks().forEach(track => { track.enabled = !next; }); setMuted(next); }
  return <section className={styles.agent} aria-label="Floww 음성 대화" data-phase={phase}><div className={styles.top}><div><span className={styles.eyebrow}>FLOWW / LIVE CONVERSATION</span><h3>말로 이어가는 대화</h3><p className={styles.subtitle}>이 작업을 자연스럽게 묻고, 다음 화면을 직접 선택하세요.</p></div><span className={styles.limit}>최대 3분</span></div>
    <div className={styles.stage}><div className={`${styles.orb} ${styles[`orb_${phase}`]}`} aria-hidden="true"><span /><span /><span /></div><p className={styles.stageLabel}>{labels[phase]}</p><p className={styles.stageMessage} role="status" aria-live="polite">{message}</p><div className={styles.wave} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
    <div className={styles.controls}><button type="button" className={styles.primary} onClick={() => void start()} disabled={!authorized || activePhase}>{phase === "error" || phase === "reconnecting" ? "다시 시작" : "음성 대화 시작"}</button><button type="button" onClick={toggleMute} disabled={!activePhase || phase === "connecting"}>{muted ? "음소거 해제" : "마이크 음소거"}</button><button type="button" onClick={() => end("음성 대화를 종료했어요.", true)} disabled={!activePhase}>대화 종료</button></div>
    {!authorized && <p className={styles.hint}>현재 작업과 지갑 로그인 상태를 확인하면 음성 대화를 시작할 수 있어요.</p>}
    {pending && authorized && pending.scope === scope && <div className={styles.confirm} role="group" aria-label="시나리오 요청 확인"><p><strong>{intentLabels[pending.intent]}</strong> 시나리오의 구매 조건 검사를 현재 작업에서 시작할까요? 이 단계는 결제나 지갑 승인이 아니에요.</p><div className={styles.controls}><button type="button" className={styles.primary} disabled={!onScenarioRequest} onClick={() => { const selected = pending; setPending(null); if (voiceScope(auth.session, connection, taskId) === selected.scope && selected.generation === serial.current) onScenarioRequest?.(selected.intent); }}>화면에서 계속</button><button type="button" onClick={() => setPending(null)}>취소</button></div></div>}
    <div className={styles.transcript}><div className={styles.transcriptHeading}><strong>실시간 대화</strong><span>{visibleLines.length ? `${visibleLines.length}개의 발화` : "아직 대화가 없어요"}</span></div>{visibleLines.length ? <ol aria-live="polite">{visibleLines.map(line => <li key={line.id} className={line.speaker === "you" ? styles.yourLine : styles.assistantLine}><span>{line.speaker === "you" ? "나" : "Floww"}</span><p>{line.text}{line.partial && <span className={styles.cursor} aria-label="기록 중">▍</span>}</p></li>)}</ol> : <p className={styles.emptyTranscript}>대화를 시작하면 말한 내용과 답변이 여기에 표시됩니다.</p>}</div>
  </section>;
}

/** A chat mic opens the same panel; starting the microphone still needs its own click. */
export function VoiceAgentLauncher({ taskId, onScenarioRequest }: { taskId?: string; onScenarioRequest?: (intent: ScenarioIntent) => void }) {
  const [open, setOpen] = useState(false);
  return <div className={styles.launcher}><button type="button" className={styles.micButton} aria-expanded={open} aria-controls="floww-voice-panel" aria-label={open ? "음성 대화 닫기" : "음성 대화 열기"} onClick={() => setOpen(value => !value)}><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/></svg><span>음성 대화</span></button>{open && <div id="floww-voice-panel"><VoiceAgent taskId={taskId} onScenarioRequest={onScenarioRequest} /></div>}</div>;
}
