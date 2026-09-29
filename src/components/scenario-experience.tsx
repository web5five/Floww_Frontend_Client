"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Clock3, ShieldCheck, Wallet } from "lucide-react";
import { tasks } from "@/lib/api/task-client";
import { toBaseUnits, type TaskEvent, type TaskQuote, type TaskView } from "@/lib/api/task-types";
import { formatFusdc } from "@/lib/pharmacy-preview";
import { canExecute, isScenarioId, latestAttempt, quoteForScenario, resultLabel, scenarioIds, scenarios, type ScenarioId } from "@/lib/scenario-presentation";
import { useWallet } from "./wallet-provider";
import { TaskExecution } from "./task-execution";
import { AccountEvidence } from "./account-evidence";

const terminal = ["COMPLETED", "DECLINED", "FAILED", "EXPIRED", "CANCELLED"];
function datetimeTomorrow() { const date = new Date(Date.now() + 24 * 60 * 60 * 1000); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function taskKey(owner: string, scenario: ScenarioId) { return `floww-scenario-task:${owner.toLowerCase()}:${scenario}`; }
function auditHref(taskId: string): string | null {
  const template = process.env.NEXT_PUBLIC_FLOWW_ADMIN_AUDIT_URL;
  if (!template?.includes("{taskId}")) return null;
  try { const url = new URL(template.replace("{taskId}", encodeURIComponent(taskId))); return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) ? url.toString() : null; }
  catch { return null; }
}

export function ScenarioExperience({ initialScenario, taskId: initialTaskId, chat = false }: { initialScenario?: string; taskId?: string; chat?: boolean }) {
  const wallet = useWallet(), owner = wallet.auth.session?.identity.address ?? "";
  const [scenario, setScenario] = useState<ScenarioId>(isScenarioId(initialScenario) ? initialScenario : "permitted");
  const [task, setTask] = useState<TaskView | null>(null), [list, setList] = useState<TaskView[]>([]);
  const [quotes, setQuotes] = useState<TaskQuote[]>([]), [events, setEvents] = useState<TaskEvent[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [stopped, setStopped] = useState(false), [ready, setReady] = useState(false), [requestLocked, setRequestLocked] = useState(false);
  const lock = useRef(false), stopLock = useRef(false), currentTaskId = useRef<string | null>(null);
  const selected = scenarios[scenario];
  const attempt = task ? latestAttempt(task) : undefined;
  const activeQuote = attempt ? quotes.find(quote => quote.quoteId === attempt.quoteId) : quoteForScenario(quotes, scenario);

  const load = useCallback(async (id: string) => {
    const [next, page] = await Promise.all([tasks.get(id), tasks.events(id, 0)]);
    if (currentTaskId.current !== id) return;
    setTask(next); setEvents(page.events);
    setStopped(!!sessionStorage.getItem(`floww-task-stop:${id}`));
    setRequestLocked(!!sessionStorage.getItem(`floww-scenario-request:${id}`));
    stopLock.current = !!sessionStorage.getItem(`floww-task-stop:${id}`);
  }, []);
  useEffect(() => {
    if (!owner) { currentTaskId.current = null; queueMicrotask(() => { setTask(null); setEvents([]); setQuotes([]); setReady(true); }); return; }
    const id = initialTaskId ?? sessionStorage.getItem(taskKey(owner, scenario));
    currentTaskId.current = id;
    queueMicrotask(() => { setTask(null); setEvents([]); setQuotes([]); setStopped(false); setRequestLocked(false); stopLock.current = false; setReady(true); });
    if (id) void load(id).catch(cause => setError(cause instanceof Error ? cause.message : "작업 조회 실패"));
  }, [owner, scenario, initialTaskId, load]);
  useEffect(() => {
    if (!task?.taskId || terminal.includes(task.status) || stopped) return;
    const id = task.taskId;
    const timer = window.setInterval(() => { if (!document.hidden && !lock.current) void load(id).catch(() => { /* Manual refresh remains available. */ }); }, 5000);
    return () => window.clearInterval(timer);
  }, [task?.taskId, task?.status, stopped, load]);
  async function run(job: () => Promise<void>, readOnly = false) {
    if (lock.current || (stopLock.current && !readOnly)) return;
    lock.current = true; setBusy(true); setError("");
    try { await job(); } catch (cause) { setError(cause instanceof Error ? cause.message : "요청을 확인하지 못했습니다. 내 작업을 조회하세요."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function refresh() { if (task) await load(task.taskId); }
  async function create(data: FormData) {
    if (!owner) throw new Error("지갑 로그인 후 작업을 만들 수 있습니다.");
    const input = { goal: String(data.get("goal")).trim(), itemId: "acetaminophen-500mg-10", maxAmountBaseUnits: toBaseUnits(String(data.get("budget"))), expiresAt: new Date(String(data.get("deadline"))).toISOString() };
    if (!input.goal || new Date(input.expiresAt) <= new Date()) throw new Error("목적과 미래 기한을 확인하세요.");
    const storage = taskKey(owner, scenario);
    const previous = sessionStorage.getItem(storage);
    if (previous) { currentTaskId.current = previous; await load(previous); return; }
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ owner: owner.toLowerCase(), scenario, input }))))].map(value => value.toString(16).padStart(2, "0")).join("");
    const keyName = `floww-task-request:${owner.toLowerCase()}:${digest}`;
    let key = sessionStorage.getItem(keyName);
    if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(keyName, key); }
    const result = await tasks.create(input, key);
    sessionStorage.setItem(storage, result.taskId); currentTaskId.current = result.taskId;
    setTask(result); setEvents([]); setNotice("서버 작업이 생성되었습니다. 아직 구매 승인이나 지급 권한은 없습니다.");
    document.getElementById("scenario-progress")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function inspectQuotes() {
    if (!task) return;
    const result = await tasks.quotes(task.taskId);
    if (result.mandateVersion !== task.mandate.version) throw new Error("견적과 작업 버전이 다릅니다. 새로 조회하세요.");
    setQuotes(result.quotes); setNotice("서버 견적을 받았습니다. 가격과 판매처를 확인하세요.");
  }
  async function inspectPolicy() {
    if (!task || task.status !== "AWAITING_APPROVAL") return;
    const quote = selected.mode === "manual" ? quoteForScenario(quotes, scenario) : undefined;
    if (selected.mode === "manual" && !quote) throw new Error("해당 판매처의 서버 견적을 하나로 식별할 수 없습니다. 서버 견적을 확인하세요.");
    sessionStorage.setItem(`floww-scenario-request:${task.taskId}`, scenario);
    setRequestLocked(true);
    if (selected.mode === "ai") {
      const result = await tasks.proposal(task.taskId);
      setNotice(`Kiln 제안: ${result.proposal.status} · 정책: ${result.attempt?.policy.decision ?? "결과 없음"}. 제안은 구매 승인이 아닙니다.`);
    } else {
      const result = await tasks.attempt(task.taskId, quote!.quoteId);
      setNotice(`사용자가 선택한 ${quote!.merchantName} 견적의 정책 검사: ${result.policy.decision}. AI가 선택한 견적이 아닙니다.`);
    }
    await refresh();
  }
  async function stop() {
    if (!task || stopLock.current) return;
    stopLock.current = true; setStopped(true);
    sessionStorage.setItem(`floww-task-stop:${task.taskId}`, new Date().toISOString());
    try { const fresh = await tasks.get(task.taskId); if (["AWAITING_APPROVAL", "ACTIVE", "EXECUTING"].includes(fresh.status)) setTask(await tasks.stop(fresh.taskId, fresh.status)); else setTask(fresh); setNotice("이 브라우저에서 후속 실행을 잠갔습니다. 서버 결과와 온체인 권한은 별도로 확인하세요."); }
    catch { setError("로컬 실행은 잠겼습니다. 서버 중단 여부는 확인되지 않았습니다. 재실행하지 말고 작업 기록을 조회하세요."); }
  }
  function choose(next: ScenarioId) { if (chat || busy) return; setScenario(next); setError(""); setNotice(""); }
  return <div className={`scenario-experience ${chat ? "chat-experience" : ""}`}>
    <div className="dashboard-title"><div><span className="eyebrow">YOUR PURCHASE, YOUR CONTROL</span><h1>{chat ? "작업 대화" : "구매를 명확하게"}<span>.</span></h1><p>{chat ? "이 화면은 같은 서버 작업의 진행 기록입니다. 별도의 결제나 자유 대화는 시작하지 않습니다." : "목적과 한도를 정하고, 서버가 제안한 구매를 검토한 뒤 직접 승인하세요."}</p></div></div>
    {!chat && <section className="scenario-grid" aria-label="구매 시나리오 선택">{scenarioIds.map((id, index) => <button key={id} type="button" className={`scenario-card ${scenario === id ? "selected" : ""}`} aria-pressed={scenario === id} disabled={busy} onClick={() => choose(id)}><span className="scenario-number">0{index + 1}</span><h2>{scenarios[id].title}</h2><p>{scenarios[id].summary}</p><span className="scenario-card-action">{scenario === id ? "선택됨" : "살펴보기"} <ArrowRight size={17} /></span></button>)}</section>}
    {!wallet.auth.session ? <section className="card scenario-panel"><Wallet size={28} aria-hidden="true" /><h2>지갑 로그인 후 시작하세요</h2><p>지갑 연결과 서버 로그인은 별개입니다. 로그인만으로 지출 권한이 생기지 않습니다.</p><Link className="button primary" href="/login">지갑 로그인</Link></section> : <>
      {!chat && <section className="card scenario-panel" aria-label="구매 요청"><div className="section-heading"><h2>{selected.title}</h2><span className="tag">서버 작업</span></div><p>{selected.summary}</p>{!task && ready ? <form onSubmit={event => { event.preventDefault(); void run(() => create(new FormData(event.currentTarget))); }}><fieldset disabled={busy}><label className="field">구매 목적<input name="goal" required maxLength={500} defaultValue="이미 처방받은 의약품 1팩을 구매하기" /></label><label className="field">전체 지출 한도 · fUSDC<input name="budget" required inputMode="decimal" defaultValue="60" /></label><label className="field">구매 기한<input name="deadline" required type="datetime-local" defaultValue={datetimeTomorrow()} /></label><p className="form-note">품목: acetaminophen 500mg 10정 · 허용 판매처와 실제 견적은 서버에서 확인합니다. 수수료와 가스는 별도 확인이 필요합니다.</p><button className="button primary" disabled={busy}>서버 작업 만들기 <ArrowRight size={17} /></button></fieldset></form> : task ? <p role="status">기존 작업을 이어갑니다. {resultLabel(task)}</p> : <p role="status">작업 조회 중</p>}</section>}
      <section id="scenario-progress" className="card scenario-panel" aria-label="작업 진행"><div className="section-heading"><h2>진행과 결과</h2>{task && <span className="tag">{task.status}</span>}</div>
        {task ? <><div className="scenario-facts"><div><ShieldCheck size={19} /><span>구매 목적</span><strong>{task.goal}</strong></div><div><Wallet size={19} /><span>전체 한도</span><strong>{formatFusdc(task.mandate.maxAmountBaseUnits)}</strong></div><div><Clock3 size={19} /><span>기한</span><strong>{new Date(task.mandate.expiresAt).toLocaleString("ko-KR")}</strong></div><div><span>판매처</span><strong>{activeQuote?.merchantName ?? attempt?.merchantId ?? "견적 확인 전"}</strong></div></div>
          <p className={`scenario-result ${attempt?.policy.decision === "DENY" ? "denied" : ""}`} role="status">{resultLabel(task)}</p>
          <div className="api-actions"><button className="button secondary" disabled={busy || stopped || task.status !== "AWAITING_APPROVAL"} onClick={() => void run(inspectQuotes)}>서버 견적 조회</button><button className="button primary" disabled={chat || busy || stopped || requestLocked || task.status !== "AWAITING_APPROVAL" || !!attempt || (selected.mode === "manual" && !quoteForScenario(quotes, scenario))} onClick={() => void run(inspectPolicy)}>{selected.action}</button><button className="button secondary" disabled={busy} onClick={() => void run(refresh, true)}>상태 새로고침</button><button className="button danger" disabled={stopped || terminal.includes(task.status)} onClick={() => void stop()}>작업 중단</button></div>
          {requestLocked && !attempt && <p className="form-note">이 작업의 제안·검사 요청 결과가 불명확합니다. 중복 요청 전에 서버 기록을 새로고침하세요.</p>}
          {quotes.length > 0 && <details className="studio-details"><summary>서버 견적 {quotes.length}개 보기</summary><ul>{quotes.map(quote => <li key={quote.quoteId}>{quote.merchantName} · {formatFusdc(quote.totalAmountBaseUnits)} · {new Date(quote.expiresAt).toLocaleString("ko-KR")}까지</li>)}</ul></details>}
          {attempt?.policy.decision === "DENY" && <p className="form-note">이 정책 거절에서는 결제 승인과 지급 요청을 진행할 수 없습니다. 거래가 없다는 증명은 서버·계정 기록에서 확인해야 합니다.</p>}
          {canExecute(task) && !stopped && <div className="scenario-execution"><h3>선택 구매 승인과 실행</h3><p>견적과 수취인을 검토하세요. 지갑 배포·서명·충전 요청은 각각 직접 확인합니다.</p><TaskExecution key={task.taskId} task={task} stopped={stopped} isStopped={() => stopLock.current} onTask={setTask} /></div>}
          <div className="api-actions">{!chat && <Link className="text-link" href={`/chat/${task.taskId}?scenario=${scenario}`}>이 작업의 대화형 진행 보기 ↗</Link>}{chat && <Link className="text-link" href={`/pharmacy?scenario=${scenario}`}>시나리오 화면으로 돌아가기 ↗</Link>}{auditHref(task.taskId) && <a className="text-link" href={auditHref(task.taskId)!} target="_blank" rel="noopener noreferrer">같은 작업의 관리자 감사 기록 ↗</a>}</div>
          <details className="studio-details"><summary>작업·정책·거래 기록</summary><dl className="purchase-details"><div><dt>Task ID</dt><dd>{task.taskId}</dd></div><div><dt>Mandate</dt><dd>{task.mandate.mandateId} · v{task.mandate.version}</dd></div><div><dt>정책</dt><dd>{attempt ? `${attempt.policy.decision} · ${attempt.policy.reasonCode ?? "사유 없음"}` : "판정 전"}</dd></div><div><dt>시도 / 견적</dt><dd>{attempt ? `${attempt.attemptId} / ${attempt.quoteId}` : "없음"}</dd></div><div><dt>지급</dt><dd>{attempt?.payment.status ?? "시도 없음"}</dd></div></dl><AccountEvidence taskId={task.taskId} taskStatus={task.status} /></details>
        </> : <p>{chat ? "작업을 조회하고 있습니다." : "시나리오를 선택하고 서버 작업을 만드세요."}</p>}</section>
      {task && <section className="card scenario-panel"><div className="section-heading"><h2>{chat ? "작업 대화" : "활동 기록"}</h2><span className="tag">서버 이벤트</span></div><ol className={chat ? "chat-events" : "purchase-events"}>{events.map(event => <li key={event.seq}><strong>{event.kind}</strong><p>{event.state}{event.reasonCode ? ` · ${event.reasonCode}` : ""}</p><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("ko-KR")}</time></li>)}</ol>{events.length === 0 && <p>기록된 이벤트가 아직 없습니다. 상태를 새로고침하세요.</p>}</section>}
      <section className="card scenario-panel"><h2>내 작업 다시 열기</h2><button className="button secondary" disabled={busy} onClick={() => void run(async () => setList(await tasks.list()), true)}>내 작업 조회</button><div className="api-actions">{list.map(item => <Link key={item.taskId} className="text-link" href={`/chat/${item.taskId}`}>{item.goal} · {item.status} ↗</Link>)}</div></section>
    </>}
    {busy && <p role="status">서버 응답을 기다리고 있습니다. 중복 요청은 잠겨 있습니다.</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}{stopped && <p role="alert">이 브라우저에서 후속 실행이 잠겼습니다. 서버와 온체인 상태를 별도로 확인하세요.</p>}
  </div>;
}
