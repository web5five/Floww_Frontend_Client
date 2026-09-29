"use client";
import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import script from "@/lib/voice-script.json";

export function VoiceGuide() {
  const [ready, setReady] = useState(false), [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("안내 음성 확인 중");
  const player = useRef<HTMLAudioElement>(null), sequence = useRef({ value: 0 });
  useEffect(() => {
    const controller = new AbortController(); const audio = player.current, counter = sequence.current;
    void fetch("/api/voice-guide", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (controller.signal.aborted) return;
      const available = body.ready === true && body.src === "/audio/floww-intro-ko.mp3";
      setReady(available); setMessage(available ? "한국어 음성 안내 · 자동 재생 없음" : "ElevenLabs 음성 준비 중 · 안내 대본 이용 가능");
    }).catch(() => { if (!controller.signal.aborted) setMessage("음성을 확인하지 못했어요 · 안내 대본을 확인하세요"); });
    const hide = () => { if (document.hidden && audio) { counter.value++; audio.pause(); setPlaying(false); setMessage("안내 일시 중지됨"); } };
    document.addEventListener("visibilitychange", hide);
    return () => { controller.abort(); counter.value++; audio?.pause(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  async function toggle() {
    const audio = player.current;
    if (!audio || !ready) return;
    const current = ++sequence.current.value;
    if (playing) { audio.pause(); audio.currentTime = 0; setPlaying(false); setMessage("안내 중지됨"); return; }
    setPlaying(true); setMessage("안내 재생 준비 중");
    try { await audio.play(); if (sequence.current.value === current) setMessage("한국어 안내 재생 중"); }
    catch { if (sequence.current.value === current) { setPlaying(false); setMessage("음성을 재생하지 못했어요 · 다시 시도하거나 대본을 확인하세요"); } }
  }
  return <section className="voice-guide" aria-label="Floww 음성 안내"><div className="voice-controls"><span className="voice-icon"><Volume2 size={22} aria-hidden="true" /></span><div><strong>처음이라면, 짧은 음성 안내</strong><p role="status">{message}</p></div><button className="button secondary" disabled={!ready} onClick={() => void toggle()}>{playing ? <Square size={16} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}{playing ? "음성 안내 중지" : "한국어 안내 듣기"}</button></div>
    <audio ref={player} src={ready ? "/audio/floww-intro-ko.mp3" : undefined} preload="none" onEnded={() => { sequence.current.value++; setPlaying(false); setMessage("안내 재생 완료"); }} onError={() => { sequence.current.value++; setPlaying(false); setMessage("음성을 불러오지 못했어요 · 안내 대본을 확인하세요"); }} />
    <details className="studio-details"><summary>안내 대본 보기</summary><p>{script.text}</p></details></section>;
}
