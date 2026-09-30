"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWallet } from "./wallet-provider";
import { useLocale } from "@/lib/i18n";
import { scenarioFromTool, type ScenarioIntent } from "@/lib/voice/contract";
import { closeVoiceResources, connectionMessage, releaseVoiceResources, updateVoiceTranscript, voiceScope, type VoiceLine, type VoiceResources } from "@/lib/voice/client-session";
import styles from "./voice-agent.module.css";

type Phase = "idle" | "connecting" | "listening" | "speaking" | "reconnecting" | "error";
type Live = VoiceResources & { peer?: RTCPeerConnection; channel?: RTCDataChannel; microphone?: MediaStream; audio?: HTMLAudioElement };
type Message = { ko: string; en: string };
const messages = {
  initial: { ko: "시작을 누르면 마이크 권한을 요청해요.", en: "Starting will request microphone access." },
  ended: { ko: "음성 대화를 종료했어요.", en: "Voice conversation ended." },
  scopeChanged: { ko: "로그인 또는 작업이 바뀌어 대화를 종료했어요.", en: "The conversation ended because your login or task changed." },
  languageChanged: { ko: "언어가 바뀌어 대화를 종료했어요. 다시 시작해 주세요.", en: "The conversation ended because the language changed. Start again." },
  checkingMic: { ko: "마이크 권한을 확인하고 있어요.", en: "Checking microphone access." },
  timedOut: { ko: "대화를 마쳤어요. 계속하려면 다시 시작해 주세요.", en: "The conversation has ended. Start again to continue." },
  setupTimedOut: { ko: "음성 연결 시간이 초과됐어요. 다시 시도해 주세요.", en: "Voice connection timed out. Try again." },
  micEnded: { ko: "마이크 연결이 종료됐어요. 마이크를 확인한 뒤 다시 시작해 주세요.", en: "Microphone access ended. Check your microphone and start again." },
  audioBlocked: { ko: "소리가 들리지 않으면 브라우저의 오디오 재생을 허용해 주세요.", en: "If you cannot hear audio, allow playback in your browser." },
  disconnected: { ko: "연결이 끊어졌어요. 다시 시작해 주세요.", en: "Connection lost. Start again." },
  listening: { ko: "말씀해 주세요. 결제나 지갑 승인은 음성으로 실행되지 않아요.", en: "Speak now. Voice cannot make payments or approve wallet actions." },
  connectionError: { ko: "음성 연결을 확인하지 못했어요. 다시 시도해 주세요.", en: "We could not connect voice. Try again." },
  confirm: { ko: "화면에서 시나리오 요청을 확인해 주세요.", en: "Review the scenario request on screen." },
} satisfies Record<string, Message>;
const labels: Record<Phase, Message> = {
  idle: { ko: "대기 중", en: "Ready" }, connecting: { ko: "마이크 연결 중", en: "Connecting microphone" },
  listening: { ko: "듣는 중", en: "Listening" }, speaking: { ko: "답변 중", en: "Responding" },
  reconnecting: { ko: "연결이 끊어졌어요", en: "Disconnected" }, error: { ko: "연결할 수 없어요", en: "Cannot connect" },
};
const intentLabels: Record<ScenarioIntent, Message> = {
  permitted: { ko: "허용된 구매", en: "Within conditions" },
  "over-budget": { ko: "예산 초과", en: "Over budget" },
  recipient: { ko: "수취인 조건", en: "Recipient condition" },
};

export function VoiceAgent({ taskId, onScenarioRequest }: { taskId?: string; onScenarioRequest?: (intent: ScenarioIntent) => void }) {
  const { auth, connection } = useWallet();
  const { locale, t } = useLocale();
  const sessionExpiry = auth.session?.expiresAt ?? "";
  const scope = voiceScope(auth.session, connection, taskId);
  const authorized = scope !== null;
  const [phase, setPhase] = useState<Phase>("idle"), [muted, setMuted] = useState(false);
  const [message, setMessage] = useState<Message>(messages.initial), [lines, setLines] = useState<VoiceLine[]>([]);
  const [transcriptScope, setTranscriptScope] = useState("");
  const [pending, setPending] = useState<{ intent: ScenarioIntent; generation: number; scope: string } | null>(null);
  const live = useRef<Live | null>(null), serial = useRef(0);
  const latestScope = useRef(scope), latestLocale = useRef(locale);
  useLayoutEffect(() => { latestScope.current = scope; }, [scope]);
  const visibleLines = authorized && transcriptScope === scope ? lines : [];
  const activePhase = ["connecting", "listening", "speaking"].includes(phase);

  const end = useCallback((notice: Message = messages.ended, graceful = false) => {
    serial.current++;
    const active = live.current; live.current = null;
    if (graceful) void closeVoiceResources(active); else releaseVoiceResources(active);
    setPending(null); setMuted(false); setPhase("idle"); setMessage(notice);
  }, []);

  useEffect(() => () => { serial.current++; const active = live.current; live.current = null; releaseVoiceResources(active); }, []);
  useEffect(() => { if (live.current) end(messages.scopeChanged); }, [scope, end]);
  useLayoutEffect(() => {
    if (latestLocale.current === locale) return;
    latestLocale.current = locale;
    if (live.current) end(messages.languageChanged);
    else { setPending(null); setMessage(messages.languageChanged); }
    setLines([]);
  }, [locale, end]);

  async function start() {
    if (!scope || voiceScope(auth.session, connection, taskId) !== scope || live.current) return;
    const startedScope = scope;
    const startedLocale = locale;
    const generation = ++serial.current;
    const sameSession = () => generation === serial.current && live.current === active;
    const current = () => sameSession() && latestScope.current === startedScope && latestLocale.current === startedLocale && Date.parse(sessionExpiry) > Date.now();
    const active: Live = { abort: new AbortController() };
    live.current = active; setPhase("connecting"); setMessage(messages.checkingMic); setLines([]); setTranscriptScope(startedScope); setPending(null);
    active.timer = setTimeout(() => { if (sameSession()) end(messages.timedOut); }, Math.max(0, Math.min(180000, Date.parse(sessionExpiry) - Date.now())));
    active.setupTimer = setTimeout(() => { if (current()) { end(messages.setupTimedOut); setPhase("error"); } }, 25000);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") throw new Error("UNSUPPORTED");
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!current()) { microphone.getTracks().forEach(track => track.stop()); return; }
      active.microphone = microphone;
      microphone.getAudioTracks().forEach(track => {
        track.addEventListener("ended", () => { if (current()) { end(messages.micEnded); setPhase("error"); } }, { once: true });
      });
      const peer = new RTCPeerConnection(); active.peer = peer;
      const audio = new Audio(); audio.autoplay = true; active.audio = audio;
      peer.ontrack = event => { if (!current()) return; audio.srcObject = event.streams[0] ?? new MediaStream([event.track]); void audio.play().catch(() => { if (current()) setMessage(messages.audioBlocked); }); };
      peer.onconnectionstatechange = () => { if (!current()) return; if (["disconnected", "failed"].includes(peer.connectionState)) { end(messages.disconnected); setPhase("reconnecting"); } };
      microphone.getAudioTracks().forEach(track => peer.addTrack(track, microphone));
      const channel = peer.createDataChannel("oai-events"); active.channel = channel;
      channel.onopen = () => { if (current()) { setPhase("listening"); setMessage(messages.listening); } };
      channel.onclose = () => { if (current()) { end(messages.disconnected); setPhase("reconnecting"); } };
      channel.onmessage = ({ data }) => {
        if (!current() || typeof data !== "string" || data.length > 32768) return;
        let event: Record<string, unknown>;
        try { event = JSON.parse(data); } catch { return; }
        if (event.type === "error") { end(messages.connectionError); setPhase("error"); return; }
        if (event.type === "session.closed") { end(messages.ended); return; }
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
          if (intent) { setPending({ intent, generation, scope: startedScope }); setMessage(messages.confirm); }
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
      const params = new URLSearchParams({ locale: startedLocale });
      if (taskId) params.set("taskId", taskId);
      const url = `/api/voice/session?${params}`;
      const result = await fetch(url, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offerSdp, cache: "no-store", signal: active.abort.signal });
      if (!current()) return;
      if (!result.ok) throw new Error(result.status === 429 ? "THROTTLED" : result.status === 401 ? "AUTH" : result.status === 404 ? "TASK" : result.status === 503 ? "CONFIG" : "CONNECT");
      const answer = await result.text(); if (!current()) return;
      if (!answer.startsWith("v=0\r\n")) throw new Error("SDP");
      await peer.setRemoteDescription({ type: "answer", sdp: answer }); if (!current()) return;
      clearTimeout(active.setupTimer); active.setupTimer = undefined;
    } catch (error) {
      if (!current()) return;
      end({ ko: connectionMessage(error), en: connectionMessage(error, "en") });
      setPhase("error");
    }
  }

  function toggleMute() { const next = !muted; live.current?.microphone?.getAudioTracks().forEach(track => { track.enabled = !next; }); setMuted(next); }
  return <section className={styles.agent} aria-label={t("Floww 음성 대화", "Floww voice conversation")} data-phase={phase}><div className={styles.top}><div><span className={styles.eyebrow}>FLOWW / {t("음성 대화", "VOICE CONVERSATION")}</span><h3>{t("말로 이어가는 대화", "Continue by voice")}</h3><p className={styles.subtitle}>{t("이 작업을 자연스럽게 묻고, 다음 화면을 직접 선택하세요.", "Ask about this task, then choose the next step on screen.")}</p></div><span className={styles.limit}>{t("최대 3분", "Up to 3 minutes")}</span></div>
    <div className={styles.stage}><div className={`${styles.orb} ${styles[`orb_${phase}`]}`} aria-hidden="true"><span /><span /><span /></div><p className={styles.stageLabel}>{t(labels[phase].ko, labels[phase].en)}</p><p className={styles.stageMessage} role="status" aria-live="polite">{t(message.ko, message.en)}</p><div className={styles.wave} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
    <div className={styles.controls}><button type="button" className={styles.primary} onClick={() => void start()} disabled={!authorized || activePhase}>{phase === "error" || phase === "reconnecting" ? t("다시 시작", "Start again") : t("음성 대화 시작", "Start voice conversation")}</button><button type="button" onClick={toggleMute} disabled={!activePhase || phase === "connecting"}>{muted ? t("음소거 해제", "Unmute microphone") : t("마이크 음소거", "Mute microphone")}</button><button type="button" onClick={() => end(messages.ended, true)} disabled={!activePhase}>{t("대화 종료", "End conversation")}</button></div>
    {!authorized && <p className={styles.hint}>{t("현재 작업과 지갑 로그인 상태를 확인하면 음성 대화를 시작할 수 있어요.", "Select a task and check your wallet login to start a voice conversation.")}</p>}
    {pending && authorized && pending.scope === scope && <div className={styles.confirm} role="group" aria-label={t("시나리오 요청 확인", "Confirm scenario request")}><p><strong>{t(intentLabels[pending.intent].ko, intentLabels[pending.intent].en)}</strong> {t("시나리오의 구매 조건 검사를 현재 작업에서 시작할까요? 이 단계는 결제나 지갑 승인이 아니에요.", "Start a purchase conditions check for this scenario on the current task? This does not make a payment or approve a wallet action.")}</p><div className={styles.controls}><button type="button" className={styles.primary} disabled={!onScenarioRequest} onClick={() => { const selected = pending; setPending(null); if (voiceScope(auth.session, connection, taskId) === selected.scope && selected.generation === serial.current) onScenarioRequest?.(selected.intent); }}>{t("화면에서 계속", "Continue on screen")}</button><button type="button" onClick={() => setPending(null)}>{t("취소", "Cancel")}</button></div></div>}
    <div className={styles.transcript}><div className={styles.transcriptHeading}><strong>{t("실시간 대화", "Live conversation")}</strong><span>{visibleLines.length ? t(`${visibleLines.length}개의 발화`, `${visibleLines.length} turns`) : t("아직 대화가 없어요", "No conversation yet")}</span></div>{visibleLines.length ? <ol aria-live="polite">{visibleLines.map(line => <li key={line.id} className={line.speaker === "you" ? styles.yourLine : styles.assistantLine}><span>{line.speaker === "you" ? t("나", "You") : "Floww"}</span><p>{line.text}{line.partial && <span className={styles.cursor} aria-label={t("기록 중", "Transcribing")}>▍</span>}</p></li>)}</ol> : <p className={styles.emptyTranscript}>{t("대화를 시작하면 말한 내용과 답변이 여기에 표시됩니다.", "Your words and the reply will appear here after you start.")}</p>}</div>
  </section>;
}

/** A chat mic opens the same panel; starting the microphone still needs its own click. */
export function VoiceAgentLauncher({ taskId, onScenarioRequest }: { taskId?: string; onScenarioRequest?: (intent: ScenarioIntent) => void }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return <div className={styles.launcher}><button type="button" className={styles.micButton} aria-expanded={open} aria-controls="floww-voice-panel" aria-label={open ? t("음성 대화 닫기", "Close voice conversation") : t("음성 대화 열기", "Open voice conversation")} onClick={() => setOpen(value => !value)}><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/></svg><span>{t("음성 대화", "Voice conversation")}</span></button>{open && <div id="floww-voice-panel"><VoiceAgent taskId={taskId} onScenarioRequest={onScenarioRequest} /></div>}</div>;
}
