"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Clock3, ShieldCheck, Wallet } from "lucide-react";
import { tasks } from "@/lib/api/task-client";
import { toBaseUnits, type TaskEvent, type TaskInput, type TaskQuote, type TaskView } from "@/lib/api/task-types";
import { formatFusdc } from "@/lib/pharmacy-preview";
import { canExecute, chatMessages, isScenarioId, latestAttempt, merchantLabel, phaseLabel, quoteForScenario, resultLabel, scenarioIds, scenarios, type JourneyPhase, type ScenarioId } from "@/lib/scenario-presentation";
import { useWallet } from "./wallet-provider";
import { TaskExecution } from "./task-execution";
import { AccountEvidence } from "./account-evidence";
import { VoiceAgentLauncher } from "./voice-agent";

type Draft = { goal: string; budget: string; deadline: string };
type Intent = { key: string; input: TaskInput; taskId: string | null; requested: boolean };
type Scope = { generation: number; owner: string; scenario: ScenarioId | null };
const terminal = ["COMPLETED", "DECLINED", "FAILED", "EXPIRED", "CANCELLED"];
const defaultGoal = "이미 처방받은 의약품 1팩 구매";
const initialDraft: Draft = { goal: defaultGoal, budget: "60", deadline: "" };
const taskKey = (owner: string, scenario: ScenarioId) => `floww-scenario-intent:${owner.toLowerCase()}:${scenario}`;
const decisionKey = (owner: string, id: string) => `floww-scenario-decision:${owner.toLowerCase()}:${id}`;
const stopKey = (id: string) => `floww-task-stop:${id}`;

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

export function ScenarioExperience({ initialScenario, taskId: initialTaskId, chat = false }: { initialScenario?: string; taskId?: string; chat?: boolean }) {
  const { auth } = useWallet();
  const owner = auth.session?.identity.address ?? "";
  const [scenario, setScenario] = useState<ScenarioId | null>(isScenarioId(initialScenario) ? initialScenario : null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [task, setTask] = useState<TaskView | null>(null), [list, setList] = useState<TaskView[]>([]);
  const [quotes, setQuotes] = useState<TaskQuote[]>([]), [events, setEvents] = useState<TaskEvent[]>([]);
  const [phase, setPhase] = useState<JourneyPhase>("idle"), [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [stopped, setStopped] = useState(false);
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
  const journey = useCallback(async (scope: Scope, givenId?: string) => {
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
    } finally { if (current(scope) && !stopRef.current) { busyRef.current = false; setBusy(false); } }
  }, [current, draft, readTask]);
  useEffect(() => {
    const signature = `${owner}|${initialTaskId ?? ""}|${initialScenario ?? ""}`;
    if (bootRef.current === signature) return;
    bootRef.current = signature;
    generationRef.current++;
    ownerRef.current = owner;
    busyRef.current = false; stopRef.current = false;
    const storedScenario = initialTaskId && owner ? scenarioIds.find(id => { try { return readIntent(owner, id)?.taskId === initialTaskId; } catch { return false; } }) : null;
    const pendingScenario = !initialTaskId && owner ? sessionStorage.getItem("floww-pending-scenario") : null;
    const selected = storedScenario ?? (isScenarioId(initialScenario) ? initialScenario : isScenarioId(pendingScenario) ? pendingScenario : null);
    scenarioRef.current = selected;
    taskIdRef.current = initialTaskId ?? null;
    const scope: Scope = { generation: generationRef.current, owner, scenario: selected };
    queueMicrotask(() => {
      if (generationRef.current !== scope.generation) return;
      setGeneration(scope.generation); setScenario(selected); setTask(null); setQuotes([]); setEvents([]); setError(""); setNotice(""); setStopped(false); setBusy(false); setPhase("idle");
      if (!owner) return;
      if (selected) sessionStorage.removeItem("floww-pending-scenario");
      if (initialTaskId && !selected) {
        void readTask(scope, initialTaskId).then(value => { if (value && current(scope, initialTaskId)) setPhase(observedPhase(scope.owner, value)); }).catch(cause => { if (current(scope, initialTaskId)) setError(cause instanceof Error ? cause.message : "작업을 확인하지 못했습니다."); });
      } else if (selected) {
        try { if (initialTaskId || pendingScenario || readIntent(owner, selected)?.taskId) void journey(scope, initialTaskId); }
        catch (cause) { if (current(scope)) { setPhase("unknown"); setError(cause instanceof Error ? cause.message : "저장된 작업을 확인하지 못했습니다."); } }
      }
    });
  }, [owner, initialTaskId, initialScenario, current, readTask, journey]);

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
    generationRef.current++; setGeneration(generationRef.current); stopRef.current = false; busyRef.current = false;
    scenarioRef.current = id; taskIdRef.current = null;
    setScenario(id); setTask(null); setQuotes([]); setEvents([]); setStopped(false); setError(""); setNotice("");
    const scope = snapshot();
    void journey(scope);
    document.getElementById("scenario-progress")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const messages = task ? chatMessages(task, events, quotes) : [];
  const admin = task ? auditHref(task.taskId) : null;
  const selected = scenario ? scenarios[scenario] : null;
  const executionScope: Scope = { generation, owner, scenario };

  return <div className={`scenario-experience ${chat ? "chat-experience" : ""}`}>
    <div className="dashboard-title"><div><span className="eyebrow">YOUR PURCHASE, YOUR CONTROL</span><h1>{chat ? "작업 대화" : "구매를 명확하게"}<span>.</span></h1><p>{chat ? "한 작업의 요청, 확인 과정과 결과를 이어서 봅니다." : "목적과 한도를 정하고, 선택된 구매만 직접 승인하세요."}</p></div></div>
    {!chat && <><section className="scenario-intent" aria-label="구매 조건"><div><strong>구매 목적</strong><span>{draft.goal}</span></div><div><strong>전체 한도</strong><span>{draft.budget} fUSDC</span></div><div><strong>기한</strong><span>{draft.deadline ? new Date(draft.deadline).toLocaleString("ko-KR") : "시작 후 24시간"}</span></div><div><strong>판매처</strong><span>서버 견적 확인 후 결정</span></div></section><details className="card scenario-edit"><summary>구매 조건 수정</summary><div className="scenario-edit-fields"><label className="field">목적<input value={draft.goal} maxLength={500} onChange={event => setDraft(old => ({ ...old, goal: event.target.value }))} disabled={busy || !!task} /></label><label className="field">전체 한도 · fUSDC<input value={draft.budget} inputMode="decimal" onChange={event => setDraft(old => ({ ...old, budget: event.target.value }))} disabled={busy || !!task} /></label><label className="field">기한<input type="datetime-local" value={draft.deadline} onChange={event => setDraft(old => ({ ...old, deadline: event.target.value }))} disabled={busy || !!task} /></label></div><p>품목은 acetaminophen 500mg 10정입니다. 판매처와 금액은 서버 견적을 받은 뒤 확인합니다.</p></details></>}
    {!chat && <section className="scenario-grid" aria-label="구매 시나리오 선택">{scenarioIds.map((id, index) => <button key={id} type="button" className={`scenario-card ${scenario === id ? "selected" : ""}`} aria-pressed={scenario === id} disabled={busy} onClick={() => choose(id)}><span className="scenario-number">0{index + 1}</span><h2>{scenarios[id].title}</h2><p>{scenarios[id].summary}</p><span className="scenario-card-action">{scenario === id ? "선택됨" : "이 경우 살펴보기"} <ArrowRight size={17} /></span></button>)}</section>}
    {!auth.session && <section className="card scenario-panel"><Wallet size={26} aria-hidden="true" /><h2>지갑 로그인 후 시작하세요</h2><p>지갑 연결과 서버 로그인은 별개입니다. 로그인만으로 구매를 승인하지 않습니다.</p><Link className="button primary" href="/login">지갑 로그인</Link></section>}
    {auth.session && <>
      <section id="scenario-progress" className="card scenario-panel" aria-label="구매 진행"><div className="section-heading"><h2>구매 진행</h2><span className="tag" role="status">{phaseLabel(phase)}</span></div>
        {!task && !scenario && <p>위에서 살펴볼 경우를 선택하세요.</p>}
        {!task && scenario && <p role="status">{phase === "unknown" ? "요청 결과를 확인해야 합니다. 같은 요청을 다시 만들지 않습니다." : phase === "error" ? "진행을 확인하지 못했습니다." : `${selected?.title} 요청을 확인하고 있습니다.`}</p>}
        {chat && task && !attempt && phase === "pending" && !busy && task.status === "AWAITING_APPROVAL" && <div className="scenario-chat-choice"><p>이 작업에서 어떤 경우를 확인할까요?</p><div className="api-actions">{scenarioIds.map(id => <button key={id} className="button secondary" onClick={() => continueInChat(id)}>{scenarios[id].title}</button>)}</div></div>}
        {task && <><div className="scenario-facts"><div><ShieldCheck size={19} /><span>구매 목적</span><strong>{task.goal}</strong></div><div><Wallet size={19} /><span>전체 한도</span><strong>{formatFusdc(task.mandate.maxAmountBaseUnits)}</strong></div><div><Clock3 size={19} /><span>기한</span><strong>{new Date(task.mandate.expiresAt).toLocaleString("ko-KR")}</strong></div><div><span>판매처</span><strong>{activeQuote?.merchantName ?? (attempt ? merchantLabel(attempt.merchantId) : "견적 확인 중")}</strong></div></div><p className={`scenario-result ${attempt?.policy.decision === "DENY" ? "denied" : ""}`} role="status">{resultLabel(task)}</p></>}
        <ol className="scenario-steps" aria-label="진행 단계"><li className={task ? "done" : phase === "creating" ? "current" : ""}>요청 저장</li><li className={quotes.length || !!attempt ? "done" : phase === "quotes" ? "current" : ""}>약국 견적 확인</li><li className={attempt ? "done" : phase === "checking" ? "current" : ""}>구매 조건 확인</li><li className={task?.status === "COMPLETED" ? "done" : task && canExecute(task) ? "current" : ""}>승인과 결과</li></ol>
        <div className="api-actions"><button className="button secondary" onClick={() => void refresh()} disabled={!task || busy}>상태 다시 확인</button>{task && !stopped && !attempt && phase === "error" && scenario && <button className="button primary" onClick={() => void journey(snapshot(), task.taskId)}>이 작업 계속 확인</button>}{task && !terminal.includes(task.status) && <button className="button danger" onClick={() => void stop()} disabled={stopped}>작업 중단</button>}</div>
        {task && canExecute(task) && !stopped && <div className="scenario-execution"><h3>선택한 구매 승인</h3><p>선택 견적과 수취인을 확인한 뒤 지갑 요청을 직접 승인하세요.</p><TaskExecution key={task.taskId} task={task} stopped={stopped} isStopped={() => stopRef.current} onTask={next => { if (next.taskId === task.taskId && current(executionScope, task.taskId) && !stopRef.current) { setTask(next); setPhase(observedPhase(executionScope.owner, next)); } }} /></div>}
        {task && <div className="api-actions">{!chat && <Link className="text-link" href={`/chat/${task.taskId}?scenario=${scenario ?? ""}`}>이 작업을 대화로 보기 ↗</Link>}{chat && <Link className="text-link" href={`/pharmacy?taskId=${encodeURIComponent(task.taskId)}&scenario=${scenario ?? ""}`}>시나리오 화면으로 돌아가기 ↗</Link>}{admin && <a className="text-link" href={admin} target="_blank" rel="noopener noreferrer">같은 작업의 관리자 기록 ↗</a>}</div>}
        {task && <details className="studio-details"><summary>구매 근거와 거래 기록</summary><p>{scenario && scenarios[scenario].mode === "manual" ? "이 견적은 사용자가 선택해 검사했습니다. AI가 선택한 견적이 아닙니다." : "제안과 정책 판정은 서버 기록을 기준으로 표시합니다."}</p><dl className="purchase-details"><div><dt>작업 ID</dt><dd>{task.taskId}</dd></div><div><dt>작업 상태</dt><dd>{task.status}</dd></div><div><dt>위임 버전</dt><dd>{task.mandate.mandateId} · v{task.mandate.version}</dd></div><div><dt>견적 / 시도</dt><dd>{attempt ? `${attempt.quoteId} / ${attempt.attemptId}` : "확인 전"}</dd></div><div><dt>정책</dt><dd>{attempt ? `${attempt.policy.decision} · ${attempt.policy.reasonCode ?? "사유 없음"}` : "판정 전"}</dd></div><div><dt>지급 상태</dt><dd>{attempt?.payment.status ?? "요청 전"}</dd></div></dl><AccountEvidence taskId={task.taskId} taskStatus={task.status} /></details>}
      </section>
      {task && <section className="card scenario-panel"><div className="section-heading"><h2>{chat ? "이 작업의 대화" : "진행 알림"}</h2><span className="tag">같은 작업 기록</span></div><ol className={chat ? "chat-messages" : "journey-messages"}>{messages.map(message => <li key={message.id} className={message.role}><strong>{message.title}</strong><p>{message.body}</p>{message.at && <time dateTime={message.at}>{new Date(message.at).toLocaleString("ko-KR")}</time>}</li>)}</ol>{!events.length && <p>서버 이벤트를 아직 받지 못했습니다. 작업 상태를 다시 확인할 수 있습니다.</p>}</section>}
      {chat && task && <section className="chat-voice-entry" aria-label="작업 대화 입력"><VoiceAgentLauncher key={`${owner}:${task.taskId}:${stopped}`} taskId={task.taskId} onScenarioRequest={!stopped && !busy ? voiceScenario : undefined} /><p>마이크를 눌러 이 작업에 대해 이야기하세요.</p><Link className="text-link" href={`/voice?taskId=${encodeURIComponent(task.taskId)}`}>음성 화면 크게 열기 ↗</Link></section>}
      <details className="card scenario-panel"><summary>내 작업 다시 열기</summary><button className="button secondary" onClick={() => void listTasks()}>내 작업 조회</button><div className="api-actions">{list.map(item => <Link key={item.taskId} className="text-link" href={`/chat/${item.taskId}`}>{item.goal} · {resultLabel(item)} ↗</Link>)}</div></details>
    </>}
    {busy && <p role="status">{phaseLabel(phase)} · 같은 요청을 중복 전송하지 않습니다.</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}{stopped && <p role="alert">이 브라우저의 후속 실행이 잠겼습니다. 서버와 체인 상태를 별도로 확인하세요.</p>}
  </div>;
}
