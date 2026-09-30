"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { VoiceAgent } from "@/components/voice-agent";
import { useLocale } from "@/lib/i18n";
import type { ScenarioIntent } from "@/lib/voice/contract";
import styles from "./voice-agent.module.css";

const taskIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function VoiceContent() {
  const { t } = useLocale();
  const params = useSearchParams(), router = useRouter();
  const taskId = params.get("taskId") ?? undefined;
  const validTask = !!taskId && taskIdPattern.test(taskId);
  const openScenario = (intent: ScenarioIntent) => { if (validTask) router.push(`/chat/${encodeURIComponent(taskId)}?scenario=${encodeURIComponent(intent)}`); };
  return <main id="main" className={styles.voicePage}><div className={styles.pageIntro}><Link href={validTask ? `/chat/${encodeURIComponent(taskId)}` : "/pharmacy"} className={styles.backLink}>← {validTask ? t("작업 대화로 돌아가기", "Back to task conversation") : t("내 작업 열기", "Open my tasks")}</Link><span className={styles.pageEyebrow}>FLOWW {t("음성 대화", "VOICE CONVERSATION")}</span><h1>{t("이 작업을 목소리로 이어가세요.", "Continue this task by voice.")}</h1><p>{t("말로 묻고 답을 들으세요. 다음 구매 조건 검사는 화면에서 직접 확인한 뒤 진행됩니다.", "Ask and listen by voice. Review the next purchase conditions check on screen before continuing.")}</p></div>{validTask ? <VoiceAgent taskId={taskId} onScenarioRequest={openScenario} /> : <div className={styles.missingTask}><strong>{t("연결할 작업을 먼저 선택해 주세요.", "Select a task to connect first.")}</strong><p>{t("음성 대화는 현재 작업과 함께 진행됩니다. 작업 화면에서 대화를 열어 주세요.", "Voice conversations belong to your current task. Open a conversation from the task screen.")}</p><Link href="/pharmacy">{t("내 작업 보기 →", "View my tasks →")}</Link></div>}<p className={styles.pageFooter}>{t("음성 안내는 결제, 지갑 승인 또는 주문 완료를 대신하지 않습니다.", "Voice guidance does not make payments, approve wallet actions or complete orders.")}</p></main>;
}

function VoiceFallback() {
  const { t } = useLocale();
  return <main id="main" className={styles.voicePage}>{t("음성 화면을 준비하고 있어요.", "Preparing voice conversation.")}</main>;
}

export default function VoicePage() {
  return <Suspense fallback={<VoiceFallback />}><VoiceContent /></Suspense>;
}
