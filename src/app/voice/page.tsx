"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { VoiceAgent } from "@/components/voice-agent";
import type { ScenarioIntent } from "@/lib/voice/contract";
import styles from "@/components/voice-agent.module.css";

const taskIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function VoiceContent() {
  const params = useSearchParams(), router = useRouter();
  const taskId = params.get("taskId") ?? undefined;
  const validTask = !!taskId && taskIdPattern.test(taskId);
  const openScenario = (intent: ScenarioIntent) => { if (validTask) router.push(`/chat/${encodeURIComponent(taskId)}?scenario=${encodeURIComponent(intent)}`); };
  return <main id="main" className={styles.voicePage}><div className={styles.pageIntro}><Link href={validTask ? `/chat/${encodeURIComponent(taskId)}` : "/pharmacy"} className={styles.backLink}>← {validTask ? "작업 대화로 돌아가기" : "내 작업 열기"}</Link><span className={styles.pageEyebrow}>FLOWW CONVERSATION</span><h1>이 작업을 목소리로 이어가세요.</h1><p>말로 묻고 답을 들으세요. 다음 구매 조건 검사는 화면에서 직접 확인한 뒤 진행됩니다.</p></div>{validTask ? <VoiceAgent taskId={taskId} onScenarioRequest={openScenario} /> : <div className={styles.missingTask}><strong>연결할 작업을 먼저 선택해 주세요.</strong><p>음성 대화는 현재 작업과 함께 진행됩니다. 작업 화면에서 대화를 열어 주세요.</p><Link href="/pharmacy">내 작업 보기 →</Link></div>}<p className={styles.pageFooter}>음성 안내는 결제, 지갑 승인 또는 주문 완료를 대신하지 않습니다.</p></main>;
}

export default function VoicePage() {
  return <Suspense fallback={<main id="main" className={styles.voicePage}>음성 화면을 준비하고 있어요.</main>}><VoiceContent /></Suspense>;
}
