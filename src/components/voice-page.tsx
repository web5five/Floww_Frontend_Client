"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useLayoutEffect, useRef, useState } from "react";
import { VoiceAgent } from "@/components/voice-agent";
import { useLocale } from "@/lib/i18n";
import { tasks } from "@/lib/api/task-client";
import { isScenarioId } from "@/lib/scenario-presentation";
import type { ScenarioIntent } from "@/lib/voice/contract";
import { stageVoiceIntent, voiceScenarioAvailability } from "@/lib/voice/confirmed-intent";
import { voiceScope } from "@/lib/voice/client-session";
import { useWallet } from "./wallet-provider";
import styles from "./voice-agent.module.css";

const taskIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function VoiceContent() {
  const { t } = useLocale();
  const { auth, connection } = useWallet();
  const params = useSearchParams(), router = useRouter();
  const taskId = params.get("taskId") ?? undefined;
  const validTask = !!taskId && taskIdPattern.test(taskId);
  const from = params.get("from");
  const previousScenario = params.get("scenario");
  const backHref = validTask ? from && ["mandate", "decision", "approval", "result"].includes(from)
    ? `/journey/${encodeURIComponent(taskId)}/${from}${isScenarioId(previousScenario) ? `?scenario=${previousScenario}` : ""}`
    : `/chat/${encodeURIComponent(taskId)}${isScenarioId(previousScenario) ? `?scenario=${previousScenario}` : ""}` : "/pharmacy";
  const owner = auth.session?.identity.address ?? "";
  const scope = voiceScope(auth.session, connection, taskId);
  const latest = useRef({ scope, taskId });
  const requestSerial = useRef(0);
  useLayoutEffect(() => {
    const serial = requestSerial;
    latest.current = { scope, taskId }; serial.current++;
    return () => { serial.current++; };
  }, [scope, taskId]);
  const [checkingState, setCheckingState] = useState<{ scope: string; taskId: string; request: number } | null>(null);
  const [feedbackState, setFeedbackState] = useState<{ scope: string; taskId: string; value: "decided" | "stopped" | "expired" | "uncertain" | "unavailable" } | null>(null);
  const checking = !!(checkingState && checkingState.scope === scope && checkingState.taskId === taskId);
  const feedback = feedbackState?.scope === scope && feedbackState.taskId === taskId ? feedbackState.value : null;
  async function openScenario(intent: ScenarioIntent) {
    if (!taskId || !validTask || !scope || checking) return;
    const selectedScope = scope, selectedTask = taskId, request = ++requestSerial.current;
    setCheckingState({ scope: selectedScope, taskId: selectedTask, request }); setFeedbackState(null);
    try {
      const currentTask = await tasks.get(selectedTask);
      if (requestSerial.current !== request || latest.current.scope !== selectedScope || latest.current.taskId !== selectedTask
        || voiceScope(auth.session, connection, selectedTask) !== selectedScope) return;
      if (currentTask.taskId.toLowerCase() !== selectedTask.toLowerCase()) throw new Error("TASK_ID_MISMATCH");
      const availability = voiceScenarioAvailability(currentTask, owner, sessionStorage);
      if (availability !== "ready") { setFeedbackState({ scope: selectedScope, taskId: selectedTask, value: availability }); return; }
      const nonce = stageVoiceIntent(sessionStorage, owner, selectedTask, intent);
      router.push(`/chat/${encodeURIComponent(selectedTask)}?scenario=${encodeURIComponent(intent)}&voice=${encodeURIComponent(nonce)}`);
    } catch { if (requestSerial.current === request && latest.current.scope === selectedScope) setFeedbackState({ scope: selectedScope, taskId: selectedTask, value: "unavailable" }); }
    finally { if (requestSerial.current === request && latest.current.scope === selectedScope) setCheckingState(null); }
  }
  const feedbackCopy = feedback === "decided" ? t("이 작업의 구매 조건은 이미 판정됐어요. 기존 기록을 확인해 주세요.", "This Task already has a decision. Review its existing record.")
    : feedback === "expired" ? t("이 작업의 기한이 지났어요. 새 구매 검사는 시작하지 않습니다.", "This Task has expired. No new purchase check will start.")
    : feedback === "stopped" ? t("현재 작업이 중단됐거나 진행할 수 없어요. 기존 기록을 확인해 주세요.", "This Task is stopped or cannot continue. Review its existing record.")
    : feedback === "uncertain" ? t("이전 견적 또는 판정 결과를 먼저 확인해 주세요. 중복 요청은 보내지 않습니다.", "Check the earlier quote or decision result first. No duplicate request will be sent.")
    : t("현재 작업 상태를 확인하지 못했어요. 작업 화면에서 다시 확인해 주세요.", "The current Task state could not be confirmed. Check it on the Task screen.");
  return <main id="main" className={styles.voicePage}><div className={styles.pageIntro}><Link href={backHref} className={styles.backLink}>← {validTask ? t("같은 작업으로 돌아가기", "Back to this Task") : t("내 작업 열기", "Open my tasks")}</Link><span className={styles.pageEyebrow}>FLOWW {t("음성 대화", "VOICE CONVERSATION")}</span><h1>{t("이 작업을 목소리로 이어가세요.", "Continue this task by voice.")}</h1><p>{t("말로 묻고 답을 들으세요. 다음 구매 조건 검사는 화면에서 직접 확인한 뒤 진행됩니다.", "Ask and listen by voice. Review the next purchase conditions check on screen before continuing.")}</p></div>{validTask ? <VoiceAgent key={taskId} taskId={taskId} onScenarioRequest={checking ? undefined : openScenario} /> : <div className={styles.missingTask}><strong>{t("연결할 작업을 먼저 선택해 주세요.", "Select a task to connect first.")}</strong><p>{t("음성 대화는 현재 작업과 함께 진행됩니다. 작업 화면에서 대화를 열어 주세요.", "Voice conversations belong to your current task. Open a conversation from the task screen.")}</p><Link href="/pharmacy">{t("내 작업 보기 →", "View my tasks →")}</Link></div>}{checking && <p className={styles.actionFeedback} role="status">{t("같은 작업의 현재 상태를 확인하고 있어요.", "Checking the current state of this Task.")}</p>}{feedback && <p className={styles.actionFeedback} role="alert">{feedbackCopy} <Link href={backHref}>{t("작업 기록 보기 →", "View Task record →")}</Link></p>}<p className={styles.pageFooter}>{t("음성 안내는 결제, 지갑 승인 또는 주문 완료를 대신하지 않습니다.", "Voice guidance does not make payments, approve wallet actions or complete orders.")}</p></main>;
}

function VoiceFallback() {
  const { t } = useLocale();
  return <main id="main" className={styles.voicePage}>{t("음성 화면을 준비하고 있어요.", "Preparing voice conversation.")}</main>;
}

export default function VoicePage() {
  return <Suspense fallback={<VoiceFallback />}><VoiceContent /></Suspense>;
}
