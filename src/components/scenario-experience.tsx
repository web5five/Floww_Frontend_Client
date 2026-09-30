"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Clock3, ShieldCheck, Wallet } from "lucide-react";
import { tasks } from "@/lib/api/task-client";
import { toBaseUnits, type TaskEvent, type TaskInput, type TaskQuote, type TaskView } from "@/lib/api/task-types";
import { formatFusdc } from "@/lib/pharmacy-preview";
import { canExecute, chatMessages, displayMerchant, isScenarioId, latestAttempt, merchantLabel, phaseLabel, quoteForScenario, resultLabel, scenarioIds, scenarios, scenarioSummary, scenarioTitle, statusLabel, type JourneyPhase, type ScenarioId } from "@/lib/scenario-presentation";
import { useWallet } from "./wallet-provider";
import { useLocale } from "@/lib/i18n";
import { TaskExecution } from "./task-execution";
import { AccountEvidence } from "./account-evidence";
import { VoiceAgentLauncher } from "./voice-agent";
import styles from "./scenario-experience.module.css";

type Draft = { goal: string; budget: string; deadline: string };
type Intent = { key: string; input: TaskInput; taskId: string | null; requested: boolean };
type Scope = { generation: number; owner: string; scenario: ScenarioId | null };
export type JourneyStep = "mandate" | "decision" | "approval" | "result";
const journeySteps: { id: JourneyStep; ko: string; en: string }[] = [{ id: "mandate", ko: "요청", en: "Request" }, { id: "decision", ko: "조건 확인", en: "Conditions" }, { id: "approval", ko: "지갑 승인", en: "Wallet approval" }, { id: "result", ko: "결과", en: "Result" }];
const terminal = ["COMPLETED", "DECLINED", "FAILED", "EXPIRED", "CANCELLED"];
const defaultGoal = "이미 처방받은 의약품 1팩 구매";
const initialDraft: Draft = { goal: defaultGoal, budget: "60", deadline: "" };
const taskKey = (owner: string, scenario: ScenarioId) => `floww-scenario-intent:${owner.toLowerCase()}:${scenario}`;
const decisionKey = (owner: string, id: string) => `floww-scenario-decision:${owner.toLowerCase()}:${id}`;
const activeScenarioKey = (owner: string) => `floww-active-scenario:${owner.toLowerCase()}`;
const stopKey = (id: string) => `floww-task-stop:${id}`;
function languageCommand(input: string): "ko" | "en" | null {
  const command = input.trim().replace(/[.!?。！？]+$/u, "").trim().replace(/\s+/g, " ");
  if (/^(?:english(?: please)?|translate to english|switch to english|show (?:it )?in english|영어로(?: 보여줘| 바꿔줘| 해줘)?|영어 부탁해)$/iu.test(command)) return "en";
  if (/^(?:korean(?: please)?|translate to korean|switch to korean|show (?:it )?in korean|한국어로(?: 보여줘| 바꿔줘| 해줘)?|한국어 부탁해)$/iu.test(command)) return "ko";
  return null;
}
const scenarioMessages: Record<string, string> = {
  "저장된 작업 연결 정보를 확인할 수 없습니다. 새 요청을 보내지 않습니다.": "Saved Task link could not be verified. No new request will be sent.",
  "작업 기록을 이어서 읽지 못했습니다.": "The rest of the Task record could not be read.",
  "더 오래된 기록은 관리자 감사 화면에서 확인하세요.": "See the admin audit view for older records.",
  "작업 생성 결과를 확인하지 못했습니다. 중복 요청을 보내지 않고 내 작업을 조회해 주세요.": "Task creation could not be confirmed. View your Tasks; no duplicate request will be sent.",
  "구매 목적과 미래 기한을 확인하세요.": "Check the purchase goal and set a future deadline.",
  "이전 구매 조건 검사 요청을 확인하고 있습니다. 중복 요청은 보내지 않습니다.": "Checking the earlier condition request. No duplicate request will be sent.",
  "이 작업의 현재 견적을 확인하지 못했습니다.": "Current quotes for this Task could not be confirmed.",
  "선택한 약국의 견적을 하나로 확인하지 못했습니다. 구매 검사를 진행하지 않습니다.": "A unique quote from the selected pharmacy could not be confirmed. The purchase check will not proceed.",
  "구매 조건 검사 결과가 아직 기록되지 않았습니다. 같은 요청을 다시 보내지 않습니다.": "The condition check has not been recorded yet. The same request will not be sent again.",
  "요청 결과를 확인하지 못했습니다.": "The request result could not be confirmed.",
  "작업을 확인하지 못했습니다.": "The Task could not be verified.",
  "이전 작업 생성 결과를 확인하지 못했습니다. 내 작업을 조회해 주세요. 같은 요청을 다시 보내지 않습니다.": "Earlier Task creation could not be confirmed. View your Tasks. No duplicate request will be sent.",
  "저장된 작업을 확인하지 못했습니다.": "The saved Task could not be verified.",
  "이전 작업 생성 결과를 먼저 확인하세요. 같은 요청을 다시 보내지 않습니다.": "Check the earlier Task creation result first. No duplicate request will be sent.",
  "이 경우에 연결된 다른 작업이 있습니다. 내 작업에서 확인하세요.": "Another Task is linked to this case. Check your Tasks.",
  "이 경우의 이전 작업 생성 결과를 먼저 확인하세요.": "Check the earlier Task creation result for this case first.",
  "작업 경로를 확인하지 못했습니다.": "The Task route could not be verified.",
  "현재 작업의 구매 조건은 이미 확인됐어요. 진행 상황을 확인하거나 구매 승인 화면에서 계속해 주세요.": "Purchase conditions for this Task have already been checked. Review progress or continue on the approval page.",
  "작업 조회 실패": "Task lookup failed.",
  "작업 목록 조회 실패": "Task list lookup failed.",
  "후속 실행을 잠갔습니다. 서버 중단을 확인하고 있습니다.": "Further actions are locked. Checking server cancellation.",
  "이 브라우저의 후속 실행을 잠갔습니다. 이미 제출된 거래는 별도 확인이 필요합니다.": "Further actions are locked in this browser. Previously submitted transactions need separate verification.",
  "서버 중단을 확인하지 못했습니다. 이 브라우저의 실행 잠금은 유지됩니다.": "Server cancellation could not be confirmed. The browser action lock remains active.",
  "금액은 양수이며 소수점 6자리까지만 입력하세요.": "Enter a positive amount with at most six decimal places.",
  "예산은 0보다 커야 합니다.": "The budget must be greater than zero.",
};
const scenarioCodes: Record<string, [string, string]> = {
  "TASK_CONNECTION_NOT_CONFIGURED": ["작업 서버 설정이 필요합니다. 지갑 인증과 업무 API 연결을 확인하세요.", "Task server configuration is required. Check wallet authentication and business API access."],
  "BACKEND_NOT_CONFIGURED": ["작업 서버 연결이 설정되지 않았습니다.", "Task server connection is not configured."],
  "UNAUTHORIZED": ["지갑 로그인이 필요하거나 세션이 만료되었습니다.", "Wallet sign-in is required or the session expired."],
  "BACKEND_ACCESS_PROTECTED": ["작업 서버 접근이 제한되어 있습니다.", "Task server access is restricted."],
  "UPSTREAM_UNAVAILABLE": ["서버 응답을 확인하지 못했습니다. 내 작업을 조회하고 중복 요청을 보내지 마세요.", "Server response could not be confirmed. Check your Tasks and do not send a duplicate request."],
  "INVALID_RESPONSE": ["서버 응답 형식이 예상과 다릅니다. 실행 전에 작업 상태를 확인하세요.", "Server response differs from the expected contract. Check Task status before continuing."],
  "CHAIN_NOT_READY": ["이 작업의 계정 또는 체인 실행이 준비되지 않았습니다.", "The account or chain execution for this Task is not ready."],
  "NOT_FOUND": ["작업을 찾지 못했습니다. 로그인한 지갑과 작업 ID를 확인하세요.", "Task not found. Check the signed-in wallet and Task ID."],
};
function scenarioCode(message: string): string | null { return /^([A-Z][A-Z0-9_]{1,63})(?: ·|$)/.exec(message)?.[1] ?? null; }
function localizedScenarioMessage(message: string, locale: "ko" | "en"): string {
  const code = scenarioCode(message);
  if (code && scenarioCodes[code]) return scenarioCodes[code][locale === "ko" ? 0 : 1];
  if (locale === "ko") return Object.hasOwn(scenarioMessages, message) ? message : "서버 결과를 확인하지 못했습니다. 다시 시도하기 전에 작업을 확인하세요.";
  return scenarioMessages[message] ?? "The server result could not be confirmed. Check the Task before trying again.";
}


function readIntent(owner: string, scenario: ScenarioId): Intent | null {
  const raw = sessionStorage.getItem(taskKey(owner, scenario));
  if (!raw) return null;
  let value: Intent;
  try { value = JSON.parse(raw) as Intent; }
  catch { throw new Error("저장된 작업 연결 정보를 확인할 수 없습니다. 새 요청을 보내지 않습니다."); }
  if (!value || typeof value.key !== "string" || !/^[0-9a-f-]{36}$/i.test(value.key)
    || typeof value.input?.goal !== "string" || typeof value.input?.maxAmountBaseUnits !== "string"
    || typeof value.input?.expiresAt !== "string" || typeof value.requested !== "boolean"
    || !(value.taskId === null || typeof value.taskId === "string")) throw new Error("저장된 작업 연결 정보를 확인할 수 없습니다. 새 요청을 보내지 않습니다.");
  return value;
}
function auditHref(taskId: string): string | null {
  const template = process.env.NEXT_PUBLIC_FLOWW_ADMIN_AUDIT_URL;
  if (!template?.includes("{taskId}")) return null;
  try { const url = new URL(template.replace("{taskId}", encodeURIComponent(taskId))); return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) ? url.toString() : null; }
  catch { return null; }
}
function taskPhase(task: TaskView): JourneyPhase {
  if (latestAttempt(task)?.policy.decision === "DENY") return "blocked";
  if (task.status === "COMPLETED") return "complete";
  if (terminal.includes(task.status)) return "closed";
  if (canExecute(task) && task.status === "AWAITING_APPROVAL") return "approval";
  return "pending";
}
function observedPhase(owner: string, task: TaskView): JourneyPhase {
  if (!task.attempts.length && sessionStorage.getItem(decisionKey(owner, task.taskId))) return "unknown";
  return taskPhase(task);
}

export function ScenarioExperience({ initialScenario, taskId: initialTaskId, chat = false, step }: { initialScenario?: string; taskId?: string; chat?: boolean; step?: JourneyStep }) {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const dateLocale = locale === "ko" ? "ko-KR" : "en-US";
  const { auth } = useWallet();
  const owner = auth.session?.identity.address ?? "";
  const [scenario, setScenario] = useState<ScenarioId | null>(isScenarioId(initialScenario) ? initialScenario : null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [task, setTask] = useState<TaskView | null>(null), [list, setList] = useState<TaskView[]>([]);
  const [quotes, setQuotes] = useState<TaskQuote[]>([]), [events, setEvents] = useState<TaskEvent[]>([]);
  const [phase, setPhase] = useState<JourneyPhase>("idle"), [busy, setBusy] = useState(false);
  const [resumeTaskId, setResumeTaskId] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [stopped, setStopped] = useState(false);
  const [chatInput, setChatInput] = useState(""), [chatFeedback, setChatFeedback] = useState<"language" | "unsupported" | null>(null);
  const generationRef = useRef(0), ownerRef = useRef(owner), scenarioRef = useRef<ScenarioId | null>(scenario);
  const taskIdRef = useRef<string | null>(initialTaskId ?? null), busyRef = useRef(false), stopRef = useRef(false);
  const bootRef = useRef("");
  useLayoutEffect(() => { ownerRef.current = owner; }, [owner]);
  const attempt = task ? latestAttempt(task) : undefined;
  const activeQuote = attempt ? quotes.find(quote => quote.quoteId === attempt.quoteId) : scenario ? quoteForScenario(quotes, scenario) : undefined;

  const current = useCallback((scope: Scope, id?: string) => generationRef.current === scope.generation
    && ownerRef.current === scope.owner && scenarioRef.current === scope.scenario
    && (id === undefined || taskIdRef.current === id), []);
  const snapshot = (): Scope => ({ generation: generationRef.current, owner: ownerRef.current, scenario: scenarioRef.current });
  const readTask = useCallback(async (scope: Scope, id: string): Promise<TaskView | null> => {
    const [next, first] = await Promise.all([tasks.get(id), tasks.events(id, 0)]);
    if (!current(scope, id)) return null;
    const collected = [...first.events]; let cursor = first.nextCursor, more = first.hasMore;
    for (let page = 1; more && page < 20; page++) {
      const nextPage = await tasks.events(id, cursor);
      if (!current(scope, id)) return null;
      if (nextPage.nextCursor <= cursor) throw new Error("작업 기록을 이어서 읽지 못했습니다.");
      collected.push(...nextPage.events); cursor = nextPage.nextCursor; more = nextPage.hasMore;
    }
    if (!current(scope, id)) return null;
    setTask(next); setEvents(collected); setPhase(observedPhase(scope.owner, next));
    if (more) setNotice("더 오래된 기록은 관리자 감사 화면에서 확인하세요.");
    if (sessionStorage.getItem(stopKey(id))) { stopRef.current = true; setStopped(true); }
    return next;
  }, [current]);
  const journey = useCallback(async (scope: Scope, givenId?: string, evaluate = true) => {
    if (busyRef.current || stopRef.current || !scope.owner || !scope.scenario || !current(scope)) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    const selected = scenarios[scope.scenario];
    try {
      let intent = readIntent(scope.owner, scope.scenario);
      let id = givenId ?? intent?.taskId ?? null;
      if (!id) {
        if (intent?.requested) { setPhase("unknown"); setError("작업 생성 결과를 확인하지 못했습니다. 중복 요청을 보내지 않고 내 작업을 조회해 주세요."); return; }
        const expiresAt = draft.deadline ? new Date(draft.deadline).toISOString() : new Date(Date.now() + 86400000).toISOString();
        const input: TaskInput = { goal: draft.goal.trim(), itemId: "acetaminophen-500mg-10", maxAmountBaseUnits: toBaseUnits(draft.budget), expiresAt };
        if (!input.goal || Date.parse(input.expiresAt) <= Date.now()) throw new Error("구매 목적과 미래 기한을 확인하세요.");
        intent = { key: crypto.randomUUID(), input, taskId: null, requested: true };
        sessionStorage.setItem(taskKey(scope.owner, scope.scenario), JSON.stringify(intent));
        setPhase("creating");
        const created = await tasks.create(intent.input, intent.key);
        // Save the identity before accepting UI state, including when the owner navigated away.
        intent = { ...intent, taskId: created.taskId };
        sessionStorage.setItem(taskKey(scope.owner, scope.scenario), JSON.stringify(intent));
        if (!current(scope)) return;
        id = created.taskId; taskIdRef.current = id; setTask(created);
      } else {
        if (taskIdRef.current !== id) taskIdRef.current = id;
        setPhase("pending");
      }
      if (!current(scope, id) || stopRef.current) return;
      let latest = await readTask(scope, id);
      if (!latest || !current(scope, id) || stopRef.current) return;
      if (!evaluate) {
        if (!initialTaskId) router.push(`/journey/${encodeURIComponent(id)}/mandate?scenario=${scope.scenario}`);
        return;
      }
      if (latest.attempts.length || latest.status !== "AWAITING_APPROVAL") { setPhase(observedPhase(scope.owner, latest)); return; }
      if (intent?.taskId !== id) { setPhase("pending"); return; }
      if (sessionStorage.getItem(decisionKey(scope.owner, id))) {
        setPhase("unknown"); setNotice("이전 구매 조건 검사 요청을 확인하고 있습니다. 중복 요청은 보내지 않습니다."); return;
      }
      setPhase("quotes");
      const collection = await tasks.quotes(id);
      if (!current(scope, id) || stopRef.current) return;
      if (collection.mandateVersion !== latest.mandate.version || !collection.quotes.length) throw new Error("이 작업의 현재 견적을 확인하지 못했습니다.");
      setQuotes(collection.quotes);
      const quote = selected.mode === "manual" ? quoteForScenario(collection.quotes, scope.scenario) : undefined;
      if (selected.mode === "manual" && !quote) throw new Error("선택한 약국의 견적을 하나로 확인하지 못했습니다. 구매 검사를 진행하지 않습니다.");
      if (!current(scope, id) || stopRef.current) return;
      sessionStorage.setItem(decisionKey(scope.owner, id), JSON.stringify({ scenario: scope.scenario, quoteId: quote?.quoteId ?? null, at: new Date().toISOString() }));
      setPhase("checking");
      if (selected.mode === "ai") {
        await tasks.proposal(id);
        if (!current(scope, id) || stopRef.current) return;
      } else {
        await tasks.attempt(id, quote!.quoteId);
        if (!current(scope, id) || stopRef.current) return;
      }
      latest = await readTask(scope, id);
      if (!latest || !current(scope, id) || stopRef.current) return;
      if (!latest.attempts.length) { setPhase("unknown"); setNotice("구매 조건 검사 결과가 아직 기록되지 않았습니다. 같은 요청을 다시 보내지 않습니다."); }
      else setPhase(observedPhase(scope.owner, latest));
    } catch (cause) {
      if (current(scope) && !stopRef.current) {
        let unresolved = !!taskIdRef.current;
        try { unresolved = taskIdRef.current ? !!sessionStorage.getItem(decisionKey(scope.owner, taskIdRef.current)) : !!readIntent(scope.owner, scope.scenario!)?.requested; }
        catch { unresolved = true; }
        setPhase(unresolved ? "unknown" : "error"); setError(cause instanceof Error ? cause.message : "요청 결과를 확인하지 못했습니다.");
      }
    } finally { if (current(scope)) { busyRef.current = false; setBusy(false); } }
  }, [current, draft, readTask, initialTaskId, router]);
  useLayoutEffect(() => {
    const signature = `${owner}|${initialTaskId ?? ""}|${initialScenario ?? ""}|${step ?? ""}`;
    if (bootRef.current === signature) return;
    bootRef.current = signature;
    generationRef.current++;
    ownerRef.current = owner;
    busyRef.current = false; stopRef.current = false;
    const storedScenario = initialTaskId && owner ? scenarioIds.find(id => { try { return readIntent(owner, id)?.taskId === initialTaskId; } catch { return false; } }) : null;
    const pendingScenario = !initialTaskId && owner ? sessionStorage.getItem("floww-pending-scenario") : null;
    const lastScenario = !initialTaskId && owner ? sessionStorage.getItem(activeScenarioKey(owner)) : null;
    const selected = storedScenario ?? (isScenarioId(initialScenario) ? initialScenario : isScenarioId(pendingScenario) ? pendingScenario : isScenarioId(lastScenario) ? lastScenario : null);
    scenarioRef.current = selected;
    taskIdRef.current = initialTaskId ?? null;
    const scope: Scope = { generation: generationRef.current, owner, scenario: selected };
    queueMicrotask(() => {
      if (generationRef.current !== scope.generation) return;
      setGeneration(scope.generation); setScenario(selected); setTask(null); setQuotes([]); setEvents([]); setError(""); setNotice(""); setStopped(false); setBusy(false); setPhase("idle"); setResumeTaskId(null); setChatFeedback(null); setChatInput("");
      if (!owner) return;
      if (selected) { sessionStorage.removeItem("floww-pending-scenario"); sessionStorage.setItem(activeScenarioKey(owner), selected); }
      if (initialTaskId && !selected) {
        void readTask(scope, initialTaskId).then(value => { if (value && current(scope, initialTaskId)) setPhase(observedPhase(scope.owner, value)); }).catch(cause => { if (current(scope, initialTaskId)) setError(cause instanceof Error ? cause.message : "작업을 확인하지 못했습니다."); });
      } else if (selected) {
        try {
          if (step === "decision" && initialTaskId) void journey(scope, initialTaskId);
          else if (initialTaskId) void readTask(scope, initialTaskId).catch(cause => { if (current(scope, initialTaskId)) setError(cause instanceof Error ? cause.message : "작업을 확인하지 못했습니다."); });
          else if (pendingScenario) void journey(scope, undefined, false);
          else if (isScenarioId(initialScenario)) void journey(scope, undefined, false);
          else {
            const previous = readIntent(owner, selected);
            if (previous?.taskId) setResumeTaskId(previous.taskId);
            else if (previous?.requested) { setPhase("unknown"); setError("이전 작업 생성 결과를 확인하지 못했습니다. 내 작업을 조회해 주세요. 같은 요청을 다시 보내지 않습니다."); }
          }
        }
        catch (cause) { if (current(scope)) { setPhase("unknown"); setError(cause instanceof Error ? cause.message : "저장된 작업을 확인하지 못했습니다."); } }
      }
    });
  }, [owner, initialTaskId, initialScenario, step, current, readTask, journey]);

  useEffect(() => {
    if (!task?.taskId || stopped || terminal.includes(task.status)) return;
    const id = task.taskId;
    const scope: Scope = { generation: generationRef.current, owner, scenario: scenarioRef.current };
    const timer = window.setInterval(() => {
      if (document.hidden || busyRef.current || !current(scope, id)) return;
      void readTask(scope, id).then(value => { if (value && current(scope, id) && !busyRef.current) setPhase(observedPhase(scope.owner, value)); }).catch(() => { /* The visible refresh action remains available. */ });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [task?.taskId, task?.status, stopped, owner, current, readTask]);

  function choose(id: ScenarioId) {
    if (busyRef.current) return;
    if (!owner) { scenarioRef.current = id; setScenario(id); sessionStorage.setItem("floww-pending-scenario", id); return; }
    sessionStorage.setItem(activeScenarioKey(owner), id);
    generationRef.current++; setGeneration(generationRef.current); stopRef.current = false; busyRef.current = false;
    scenarioRef.current = id; taskIdRef.current = null;
    setScenario(id); setTask(null); setQuotes([]); setEvents([]); setStopped(false); setError(""); setNotice(""); setResumeTaskId(null);
    const scope = snapshot();
    try {
      const existing = readIntent(owner, id);
      if (existing?.taskId) { router.push(`/journey/${encodeURIComponent(existing.taskId)}/mandate?scenario=${id}`); return; }
      if (existing?.requested) { setPhase("unknown"); setError("이전 작업 생성 결과를 먼저 확인하세요. 같은 요청을 다시 보내지 않습니다."); return; }
      void journey(scope, undefined, false);
    } catch (cause) { setPhase("unknown"); setError(cause instanceof Error ? cause.message : "저장된 작업을 확인하지 못했습니다."); }
  }
  function continueInChat(id: ScenarioId) {
    if (!chat || !task || !owner || busyRef.current || stopRef.current || task.status !== "AWAITING_APPROVAL" || task.attempts.length) return;
    try {
      const previous = readIntent(owner, id);
      if (previous?.taskId && previous.taskId !== task.taskId) throw new Error("이 경우에 연결된 다른 작업이 있습니다. 내 작업에서 확인하세요.");
      if (previous && !previous.taskId) throw new Error("이 경우의 이전 작업 생성 결과를 먼저 확인하세요.");
      if (!previous) sessionStorage.setItem(taskKey(owner, id), JSON.stringify({ key: crypto.randomUUID(), input: { goal: task.goal, itemId: task.mandate.itemId, maxAmountBaseUnits: task.mandate.maxAmountBaseUnits, expiresAt: task.mandate.expiresAt }, taskId: task.taskId, requested: true } satisfies Intent));
      generationRef.current++; setGeneration(generationRef.current); scenarioRef.current = id; setScenario(id);
      const scope = snapshot();
      void journey(scope, task.taskId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "작업 경로를 확인하지 못했습니다."); }
  }
  function voiceScenario(id: ScenarioId) {
    if (!task || !owner || busyRef.current || stopRef.current) return;
    if (task.attempts.length || task.status !== "AWAITING_APPROVAL") {
      setNotice("현재 작업의 구매 조건은 이미 확인됐어요. 진행 상황을 확인하거나 구매 승인 화면에서 계속해 주세요.");
      void refresh();
      return;
    }
    continueInChat(id);
  }
  async function refresh() {
    if (!taskIdRef.current || !owner || busyRef.current) return;
    const scope = snapshot(), id = taskIdRef.current;
    try { const next = await readTask(scope, id); if (next && current(scope, id)) { setPhase(observedPhase(scope.owner, next)); setError(""); } }
    catch (cause) { if (current(scope, id)) setError(cause instanceof Error ? cause.message : "작업 조회 실패"); }
  }
  async function stop() {
    const id = taskIdRef.current;
    if (!id || !task || stopRef.current) return;
    generationRef.current++; setGeneration(generationRef.current); stopRef.current = true; busyRef.current = false;
    sessionStorage.setItem(stopKey(id), new Date().toISOString());
    setStopped(true); setBusy(false); setNotice("후속 실행을 잠갔습니다. 서버 중단을 확인하고 있습니다.");
    const scope = snapshot();
    try {
      const fresh = await tasks.get(id);
      if (generationRef.current !== scope.generation || ownerRef.current !== scope.owner || taskIdRef.current !== id) return;
      const result = ["AWAITING_APPROVAL", "ACTIVE", "EXECUTING"].includes(fresh.status) ? await tasks.stop(id, fresh.status) : fresh;
      if (generationRef.current !== scope.generation || ownerRef.current !== scope.owner || taskIdRef.current !== id) return;
      setTask(result); setNotice("이 브라우저의 후속 실행을 잠갔습니다. 이미 제출된 거래는 별도 확인이 필요합니다.");
    } catch { if (generationRef.current === scope.generation && taskIdRef.current === id) setError("서버 중단을 확인하지 못했습니다. 이 브라우저의 실행 잠금은 유지됩니다."); }
  }
  async function listTasks() {
    const scope = snapshot();
    try { const items = await tasks.list(); if (generationRef.current === scope.generation && ownerRef.current === scope.owner) setList(items); }
    catch (cause) { if (generationRef.current === scope.generation) setError(cause instanceof Error ? cause.message : "작업 목록 조회 실패"); }
  }
  const messages = task ? chatMessages(task, events, quotes, locale) : [];
  const admin = task ? auditHref(task.taskId) : null;
  const executionScope: Scope = { generation, owner, scenario };
  const journeyHref = (target: JourneyStep) => task ? `/journey/${encodeURIComponent(task.taskId)}/${target}${scenario ? `?scenario=${scenario}` : ""}` : "/pharmacy";
  const stepIndex = journeySteps.findIndex(item => item.id === step);
  const showOverview = !chat && !step;

  return <div className={`scenario-experience ${chat ? "chat-experience" : ""}`}>
    <div className="dashboard-title"><div><span className="eyebrow">{t("내 구매, 내 선택", "YOUR PURCHASE, YOUR CONTROL")}</span><h1>{chat ? t("작업 대화", "Task conversation") : step ? journeySteps[stepIndex][locale] : t("구매를 명확하게", "Purchase with clarity")}<span>.</span></h1><p>{chat ? t("한 작업의 요청, 확인 과정과 결과를 이어서 봅니다.", "Follow the request, checks, and result for this Task.") : step ? t("같은 작업의 실제 기록을 단계별로 확인하세요.", "Review the actual record for this Task step by step.") : t("목적과 한도를 정하고, 선택된 구매만 직접 승인하세요.", "Set a goal and limit, then approve only the selected purchase yourself.")}</p></div></div>
    {step && <nav className="journey-step-nav" aria-label={t("구매 단계", "Purchase steps")}><ol>{journeySteps.map((item, index) => <li key={item.id} className={index === stepIndex ? "current" : ""}>{task ? <Link href={journeyHref(item.id)} aria-current={item.id === step ? "step" : undefined}><span>0{index + 1}</span>{item[locale]}</Link> : <span><span>0{index + 1}</span>{item[locale]}</span>}</li>)}</ol></nav>}
    {showOverview && <><section className="scenario-intent" aria-label={t("구매 조건", "Purchase conditions")}><div><strong>{t('구매 목적', 'Purchase goal')}</strong><span>{(draft.goal === defaultGoal ? t(defaultGoal, "Buy one pack of previously prescribed medicine") : draft.goal)}</span></div><div><strong>{t('전체 한도', 'Total limit')}</strong><span>{draft.budget} fUSDC</span></div><div><strong>{t('기한', 'Deadline')}</strong><span>{draft.deadline ? new Date(draft.deadline).toLocaleString(dateLocale) : t("시작 후 24시간", "24 hours after start")}</span></div><div><strong>{t('판매처', 'Merchant')}</strong><span>{t('서버 견적 확인 후 결정', 'Chosen after server quotes')}</span></div></section><details className="card scenario-edit"><summary>{t('구매 조건 수정', 'Edit purchase conditions')}</summary><div className="scenario-edit-fields"><label className="field">{t('목적', 'Goal')}<input value={draft.goal === defaultGoal ? t(defaultGoal, "Buy one pack of previously prescribed medicine") : draft.goal} maxLength={500} onChange={event => setDraft(old => ({ ...old, goal: event.target.value }))} disabled={busy || !!task} /></label><label className="field">{t('전체 한도 · fUSDC', 'Total limit · fUSDC')}<input value={draft.budget} inputMode="decimal" onChange={event => setDraft(old => ({ ...old, budget: event.target.value }))} disabled={busy || !!task} /></label><label className="field">{t('기한', 'Deadline')}<input type="datetime-local" value={draft.deadline} onChange={event => setDraft(old => ({ ...old, deadline: event.target.value }))} disabled={busy || !!task} /></label></div><p>{t('품목은 acetaminophen 500mg 10정입니다. 판매처와 금액은 서버 견적을 받은 뒤 확인합니다.', 'The item is acetaminophen 500 mg, 10 tablets. The merchant and amount are confirmed after receiving server quotes.')}</p></details></>}
    {showOverview && <section className="scenario-grid" aria-label={t("구매 시나리오 선택", "Choose a purchase scenario")}>{scenarioIds.map((id, index) => <button key={id} type="button" className={`scenario-card ${scenario === id ? "selected" : ""}`} aria-pressed={scenario === id} disabled={busy} onClick={() => choose(id)}><span className="scenario-number">0{index + 1}</span><h2>{scenarioTitle(id, locale)}</h2><p>{scenarioSummary(id, locale)}</p><span className="scenario-card-action">{scenario === id ? t("선택됨", "Selected") : t("이 경우 살펴보기", "Explore this case")} <ArrowRight size={17} /></span></button>)}</section>}
    {!auth.session && <section className="card scenario-panel"><Wallet size={26} aria-hidden="true" /><h2>{t('지갑 로그인 후 시작하세요', 'Sign in with your wallet to start')}</h2><p>{t('지갑 연결과 서버 로그인은 별개입니다. 로그인만으로 구매를 승인하지 않습니다.', 'Wallet connection and server sign-in are separate. Signing in does not approve a purchase.')}</p><Link className="button primary" href="/login">{t('지갑 로그인', 'Wallet sign-in')}</Link></section>}
    {auth.session && <>
      <section id="scenario-progress" className="card scenario-panel" aria-label={t("구매 진행", "Purchase progress")}><div className="section-heading"><h2>{t("구매 진행", "Purchase progress")}</h2><span className="tag" role="status">{phaseLabel(phase, locale)}</span></div>
        {!task && !scenario && <p>{t('위에서 살펴볼 경우를 선택하세요.', 'Choose a case above.')}</p>}
        {!task && scenario && <p role="status">{phase === "unknown" ? t("요청 결과를 확인해야 합니다. 같은 요청을 다시 만들지 않습니다.", "The request result needs checking. No duplicate request will be made.") : phase === "error" ? t("진행을 확인하지 못했습니다.", "Progress could not be confirmed.") : resumeTaskId ? t("이전에 저장한 작업을 다시 열 수 있습니다.", "You can reopen your saved Task.") : `${scenario ? scenarioTitle(scenario, locale) : ""} ${t("요청을 확인하고 있습니다.", "request is being checked.")}`}</p>}
        {!task && resumeTaskId && scenario && <Link className="button secondary" href={`/journey/${encodeURIComponent(resumeTaskId)}/mandate?scenario=${scenario}`}>{t('이 작업 다시 열기', 'Reopen this Task')}</Link>}
        {chat && task && !attempt && phase === "pending" && !busy && task.status === "AWAITING_APPROVAL" && <div className="scenario-chat-choice"><p>{t('이 작업에서 어떤 경우를 확인할까요?', 'Which case should this Task check?')}</p><div className="api-actions">{scenarioIds.map(id => <button key={id} className="button secondary" onClick={() => continueInChat(id)}>{scenarioTitle(id, locale)}</button>)}</div></div>}
        {task && <><div className="scenario-facts"><div><ShieldCheck size={19} /><span>{t('구매 목적', 'Purchase goal')}</span><strong>{task.goal === defaultGoal ? t(defaultGoal, "Buy one pack of previously prescribed medicine") : task.goal}</strong></div><div><Wallet size={19} /><span>{t('전체 한도', 'Total limit')}</span><strong>{formatFusdc(task.mandate.maxAmountBaseUnits)}</strong></div><div><Clock3 size={19} /><span>{t('기한', 'Deadline')}</span><strong>{new Date(task.mandate.expiresAt).toLocaleString(dateLocale)}</strong></div><div><span>{t('판매처', 'Merchant')}</span><strong>{(activeQuote ? displayMerchant(activeQuote.merchantId, activeQuote.merchantName, locale) : attempt ? merchantLabel(attempt.merchantId, locale) : t("견적 확인 중", "Checking quotes"))}</strong></div></div><p className={`scenario-result ${attempt?.policy.decision === "DENY" ? "denied" : ""}`} role="status">{resultLabel(task, locale)}</p></>}
        {chat && <ol className="scenario-steps" aria-label={t("진행 단계", "Progress steps")}><li className={task ? "done" : phase === "creating" ? "current" : ""}>{t('요청 저장', 'Save request')}</li><li className={quotes.length || !!attempt ? "done" : phase === "quotes" ? "current" : ""}>{t('약국 견적 확인', 'Check pharmacy quotes')}</li><li className={attempt ? "done" : phase === "checking" ? "current" : ""}>{t('구매 조건 확인', 'Check purchase conditions')}</li><li className={task?.status === "COMPLETED" ? "done" : task && canExecute(task) ? "current" : ""}>{t('승인과 결과', 'Approval and result')}</li></ol>}
        <div className="api-actions"><button className="button secondary" onClick={() => void refresh()} disabled={!task || busy}>{t('상태 다시 확인', 'Refresh status')}</button>{task && !stopped && !attempt && phase === "error" && scenario && <button className="button primary" onClick={() => void journey(snapshot(), task.taskId)}>{t('이 작업 계속 확인', 'Continue checking this Task')}</button>}{task && !terminal.includes(task.status) && <button className="button danger" onClick={() => void stop()} disabled={stopped}>{t('작업 중단', 'Stop Task')}</button>}</div>
        {task && canExecute(task) && !stopped && (chat || step === "approval") && <div className="scenario-execution"><h3>{t('선택한 구매 승인', 'Approve selected purchase')}</h3><p>{t('선택 견적과 수취인을 확인한 뒤 지갑 요청을 직접 승인하세요.', 'Review the selected quote and recipient, then approve the wallet request yourself.')}</p><TaskExecution key={task.taskId} task={task} stopped={stopped} isStopped={() => stopRef.current} onTask={next => { if (next.taskId === task.taskId && current(executionScope, task.taskId) && !stopRef.current) { setTask(next); setPhase(observedPhase(executionScope.owner, next)); } }} /></div>}
        {task && step === "mandate" && <Link className="button primary" href={journeyHref("decision")}>{t("구매 조건 확인하기", "Check purchase conditions")} <ArrowRight size={17} /></Link>}
        {task && step === "decision" && attempt && <Link className="button primary" href={journeyHref(attempt.policy.decision === "ALLOW" ? "approval" : "result")}>{attempt.policy.decision === "ALLOW" ? t("지갑 승인 화면", "Wallet approval page") : t("차단 결과 확인", "View blocked result")} <ArrowRight size={17} /></Link>}
        {task && step === "approval" && <Link className="text-link" href={journeyHref("result")}>{t('현재 결과 확인 ↗', 'View current result ↗')}</Link>}
        {task && step === "result" && canExecute(task) && !stopped && <Link className="text-link" href={journeyHref("approval")}>{t('지갑 승인 화면으로 돌아가기 ↗', 'Return to wallet approval ↗')}</Link>}
        {task && <div className="api-actions">{!chat && <Link className="text-link" href={`/chat/${task.taskId}?scenario=${scenario ?? ""}`}>{t('이 작업을 대화로 보기 ↗', 'View this Task as a conversation ↗')}</Link>}{chat && <Link className="text-link" href={journeyHref(attempt?.policy.decision === "DENY" ? "result" : canExecute(task) ? "approval" : "mandate")}>{t('시나리오 화면으로 돌아가기 ↗', 'Return to scenario page ↗')}</Link>}{admin && <a className="text-link" href={admin} target="_blank" rel="noopener noreferrer">{t('같은 작업의 관리자 기록 ↗', 'Admin record for this Task ↗')}</a>}</div>}
        {task && <details className="studio-details"><summary>{t('구매 근거와 거래 기록', 'Purchase basis and transaction record')}</summary><p>{scenario && scenarios[scenario].mode === "manual" ? t("이 견적은 사용자가 선택해 검사했습니다. AI가 선택한 견적이 아닙니다.", "The user selected this quote for checking. AI did not select it.") : t("제안과 정책 판정은 서버 기록을 기준으로 표시합니다.", "Proposal and policy decisions are shown from server records.")}</p><dl className="purchase-details"><div><dt>{t('작업 ID', 'Task ID')}</dt><dd>{task.taskId}</dd></div><div><dt>{t('작업 상태', 'Task status')}</dt><dd>{statusLabel(task.status, locale)} <code>{task.status}</code></dd></div><div><dt>{t('위임 버전', 'Mandate version')}</dt><dd>{task.mandate.mandateId} · v{task.mandate.version}</dd></div><div><dt>{t('견적 / 시도', 'Quote / attempt')}</dt><dd>{attempt ? `${attempt.quoteId} / ${attempt.attemptId}` : t("확인 전", "Not checked")}</dd></div><div><dt>{t('정책', 'Policy')}</dt><dd>{attempt ? `${statusLabel(attempt.policy.decision, locale)} · ${attempt.policy.reasonCode ?? t("사유 없음", "No reason")}` : t("판정 전", "Not decided")}</dd></div><div><dt>{t('지급 상태', 'Payment status')}</dt><dd>{attempt ? statusLabel(attempt.payment.status, locale) : t("요청 전", "Not requested")}</dd></div></dl><AccountEvidence taskId={task.taskId} taskStatus={task.status} /></details>}
      </section>
      {(chat || step === "result") && task && <section className="card scenario-panel"><div className="section-heading"><h2>{chat ? t("이 작업의 대화", "Conversation for this Task") : t("진행 알림", "Progress updates")}</h2><span className="tag">{t('같은 작업 기록', 'Same Task record')}</span></div><ol className={chat ? "chat-messages" : "journey-messages"}>{messages.map(message => <li key={message.id} className={message.role}><strong>{message.title}</strong><p>{message.body}</p>{message.at && <time dateTime={message.at}>{new Date(message.at).toLocaleString(dateLocale)}</time>}</li>)}</ol>{!events.length && <p>{t('서버 이벤트를 아직 받지 못했습니다. 작업 상태를 다시 확인할 수 있습니다.', 'No server events have been received yet. You can refresh Task status.')}</p>}</section>}
      {chat && task && <section className="chat-voice-entry" aria-label={t("작업 대화 입력", "Task conversation input")}>
        <form className={styles.languageForm} onSubmit={event => {
          event.preventDefault();
          const next = languageCommand(chatInput);
          setChatInput("");
          if (next) { setChatFeedback("language"); setLocale(next); }
          else setChatFeedback("unsupported");
        }}>
          <label className={`field ${styles.languageField}`}>{t("화면 언어 요청", "Display language request")}
            <input value={chatInput} maxLength={120} onChange={event => setChatInput(event.target.value)} placeholder={t("예: 영어로 보여줘", "e.g. English please")} autoComplete="off" />
          </label>
          <button className={`button secondary ${styles.sendButton}`} type="submit" disabled={!chatInput.trim()}>{t("요청 보내기", "Send request")}</button>
        </form>
        {chatFeedback && <p className={styles.feedback} role="status">{chatFeedback === "language"
          ? t("화면 언어를 한국어로 설정했습니다. 같은 작업을 계속 보고 있습니다.", "Display language set to English. You are viewing the same Task.")
          : t("화면 언어는 ‘영어로 보여줘’ 또는 ‘한국어로 바꿔줘’로 요청할 수 있어요. 작업에 대해 이야기하려면 마이크를 눌러주세요.", "To change the display language, ask ‘English please’ or ‘Korean please’. To talk about this Task, use the microphone.")}</p>}
        <div className={styles.voiceTools}><VoiceAgentLauncher key={`${owner}:${task.taskId}:${stopped}`} taskId={task.taskId} onScenarioRequest={!stopped && !busy ? voiceScenario : undefined} /><p>{t('마이크를 눌러 이 작업에 대해 이야기하세요.', 'Press the microphone to talk about this Task.')}</p><Link className="text-link" href={`/voice?taskId=${encodeURIComponent(task.taskId)}`}>{t('음성 화면 크게 열기 ↗', 'Open full voice view ↗')}</Link></div></section>}
      <details className="card scenario-panel"><summary>{t('내 작업 다시 열기', 'Reopen my Tasks')}</summary><button className="button secondary" onClick={() => void listTasks()}>{t('내 작업 조회', 'View my Tasks')}</button><div className="api-actions">{list.map(item => <Link key={item.taskId} className="text-link" href={`/chat/${item.taskId}`}>{item.goal === defaultGoal ? t(defaultGoal, "Buy one pack of previously prescribed medicine") : item.goal} · {resultLabel(item, locale)} ↗</Link>)}</div></details>
    </>}
    {busy && <p role="status">{phaseLabel(phase, locale)} · {t("같은 요청을 중복 전송하지 않습니다.", "No duplicate request will be sent.")}</p>}{notice && <p role="status">{localizedScenarioMessage(notice, locale)}</p>}{error && <><p role="alert">{localizedScenarioMessage(error, locale)}</p>{scenarioCode(error) && <details className="studio-details"><summary>{t("진단 코드", "Diagnostic code")}</summary><code>{scenarioCode(error)}</code></details>}</>}{stopped && <p role="alert">{t('이 브라우저의 후속 실행이 잠겼습니다. 서버와 체인 상태를 별도로 확인하세요.', 'Further actions are locked in this browser. Check server and chain status separately.')}</p>}
  </div>;
}
