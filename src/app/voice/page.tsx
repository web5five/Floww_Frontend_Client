"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { VoiceAgent } from "@/components/voice-agent";
import type { ScenarioIntent } from "@/lib/voice/contract";

function VoiceContent() {
  const params = useSearchParams(), router = useRouter();
  const taskId = params.get("taskId") ?? undefined;
  const openScenario = (intent: ScenarioIntent) => router.push(taskId ? `/chat/${encodeURIComponent(taskId)}?scenario=${encodeURIComponent(intent)}` : `/pharmacy?scenario=${encodeURIComponent(intent)}`);
  return <main id="main" style={{ width: "min(100% - 32px, 660px)", margin: "48px auto 80px" }}><div style={{ marginBottom: 24 }}><span style={{ fontSize: 12, letterSpacing: ".15em", fontWeight: 800, color: "#397693" }}>FLOWW CONVERSATION</span><h1 style={{ margin: "8px 0" }}>음성으로 대화하기</h1><p>Floww의 안내를 듣고 질문할 수 있어요. 작업 상태와 구매 결과는 화면의 서버 기록을 확인해 주세요.</p></div><VoiceAgent taskId={taskId} onScenarioRequest={openScenario} /></main>;
}

export default function VoicePage() {
  return <Suspense fallback={<main id="main" style={{ width: "min(100% - 32px, 660px)", margin: "48px auto 80px" }}>음성 화면을 준비하고 있어요.</main>}><VoiceContent /></Suspense>;
}
