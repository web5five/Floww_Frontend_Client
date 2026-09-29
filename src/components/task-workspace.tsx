"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card } from "./ui";
import { useWallet } from "./wallet-provider";
import { tasks } from "@/lib/api/task-client";
import { toBaseUnits, type TaskView, type TaskQuote, type TaskEvent } from "@/lib/api/task-types";
import { formatFusdc } from "@/lib/pharmacy-preview";

export function TaskWorkspace() {
  const { auth } = useWallet();
  return <Card id="server-task" className="pharmacy-section"><div className="section-heading"><h2>서버 Task · 실제 API 연결</h2><span className="tag">서버 응답 전용 · 데모와 분리</span></div>
    <p className="form-note">Task 생성 → 서버 약국 견적 → Kiln 제안 → 정책 판정까지 연결합니다. 모델 호출은 비용이 발생할 수 있습니다. 현재 서버·컨트랙트 승인 스키마 정렬 전이므로 실제 지출 서명·주문·결제는 활성화하지 않습니다.</p>
    {auth.session ? <AuthenticatedTasks key={auth.session.identity.address} /> : <><p>지갑 로그인 후 서버 작업을 생성하거나 조회할 수 있습니다. 환경설정이 없으면 로그인 화면에 연결 전 상태가 표시됩니다.</p><Link href="/login" className="button primary">지갑 로그인으로 이동</Link></>}
    <Link href="/dashboard#backend-workspace" className="text-link">추가 질문·AI 초안 및 기존 실행 API 화면 ↗</Link>
  </Card>;
}
function AuthenticatedTasks() {
  const [task, setTask] = useState<TaskView | null>(null), [list, setList] = useState<TaskView[]>([]);
  const [quotes, setQuotes] = useState<TaskQuote[]>([]), [events, setEvents] = useState<TaskEvent[]>([]);
  const [quoteVersion, setQuoteVersion] = useState<number | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [stopped, setStopped] = useState(false), [poll, setPoll] = useState(false);
  const lock = useRef(false), stopLock = useRef(false), mounted = useRef(true);
  const createKey = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function run(job: () => Promise<void>) {
    if (lock.current || stopLock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await job(); } catch (e) { if (mounted.current && !stopLock.current) setError(e instanceof Error ? e.message : "서버 요청 실패"); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function accept(t: TaskView) { if (mounted.current && !stopLock.current) setTask(t); }
  const taskId = task?.taskId;
  useEffect(() => {
    if (!poll || !taskId || stopped) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let cursor = 0;
    async function tick() {
      try {
        const [next, page] = await Promise.all([tasks.get(taskId!, controller.signal), tasks.events(taskId!, cursor, controller.signal)]);
        if (controller.signal.aborted || stopLock.current) return;
        setTask(next); setEvents(old => [...new Map([...old, ...page.events].map(e => [e.seq, e])).values()].sort((a, b) => a.seq - b.seq)); cursor = page.nextCursor;
        if (page.hasMore || ["AWAITING_APPROVAL", "ACTIVE", "EXECUTING"].includes(next.status)) timer = setTimeout(tick, page.hasMore ? 300 : 5000);
        else setPoll(false);
      } catch (e) { if (!controller.signal.aborted) { setPoll(false); setError(e instanceof Error ? e.message : "조회 실패"); } }
    }
    void tick(); return () => { controller.abort(); clearTimeout(timer); };
  }, [poll, taskId, stopped]);
  async function stop() {
    if (!task || stopLock.current) return;
    stopLock.current = true; setStopped(true); setPoll(false); setNotice("STOPPED · 로컬 동작 잠금. 서버 중단 결과 확인 중");
    try { sessionStorage.setItem(`floww-task-stop:${task.taskId}`, JSON.stringify({ at: new Date().toISOString(), reason: "USER_STOPPED", taskId: task.taskId })); } catch { /* The in-memory stop remains authoritative for this page. */ }
    try {
      const latest = await tasks.get(task.taskId);
      const result = ["AWAITING_APPROVAL", "ACTIVE", "EXECUTING"].includes(latest.status) ? await tasks.stop(latest.taskId, latest.status) : latest;
      if (mounted.current) { setTask(result); setNotice(`STOPPED · 로컬 잠금 유지 / 서버 상태: ${result.status}. 이미 발생한 주문이나 지급을 되돌린다는 뜻이 아닙니다.`); }
    } catch { if (mounted.current) setError("로컬 STOPPED 유지 · 서버 중단 확인 실패. 원격 중단·권한 폐기를 보장하지 않습니다. 다른 경로에서 실행하지 말고 서버 담당자에게 작업 ID를 전달하세요."); }
  }
  return <>
    <form className="purchase-form" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      void run(async () => {
        const input = { goal: String(data.get("goal")), itemId: String(data.get("item")), maxAmountBaseUnits: toBaseUnits(String(data.get("budget"))), expiresAt: new Date(String(data.get("deadline"))).toISOString() };
        const body = JSON.stringify(input); if (createKey.current?.body !== body) createKey.current = { body, key: crypto.randomUUID() };
        const result = await tasks.create(input, createKey.current.key);
        if (!mounted.current || stopLock.current) return;
        setQuotes([]); setEvents([]); accept(result); setPoll(true); setNotice("서버 Task 생성됨 · Mandate 초안이며 위임 승인 아님");
      });
    }}><fieldset disabled={busy || stopped || !!task}><legend>서버 구매 요청</legend><label className="field">구매 목적<input name="goal" required maxLength={500} defaultValue="이미 처방받은 의약품 1팩을 예산 내 배송받기" /></label><label className="field">서버 시뮬레이터 품목<select name="item"><option value="acetaminophen-500mg-10">acetaminophen-500mg-10</option><option value="ibuprofen-200mg-20">ibuprofen-200mg-20</option></select></label><label className="field">최대 예산 (fUSDC)<input name="budget" inputMode="decimal" required defaultValue="60" /></label><label className="field">구매 기한 (현재 시간대, 30일 이내)<input name="deadline" type="datetime-local" required /></label><button className="button primary" type="submit">서버 Task 생성</button></fieldset></form>
    <div className="api-actions"><button className="button secondary" disabled={busy || stopped} onClick={() => void run(async () => { const items = await tasks.list(); if (mounted.current && !stopLock.current) setList(items); })}>내 작업 조회</button>{list.map(item => <button className="button secondary" key={item.taskId} disabled={busy || stopped} onClick={() => { setQuotes([]); setEvents([]); setNotice(""); setTask(item); let saved = false; try { saved = !!sessionStorage.getItem(`floww-task-stop:${item.taskId}`); } catch { /* Storage may be unavailable. */ } if (saved) { stopLock.current = true; setStopped(true); setPoll(false); setNotice("STOPPED · 이 브라우저 세션의 중단 기록 유지. 서버 상태와 별개로 재실행하지 않습니다."); } else setPoll(true); }}>{item.taskId.slice(0, 8)} · {item.status}</button>)}</div>
    {busy && <p role="status">서버 응답 대기 중 · 중복 호출 금지</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {task && <>
      <dl className="purchase-details"><div><dt>Task ID / 서버 상태</dt><dd>{task.taskId} · {task.status}</dd></div><div><dt>Mandate / 버전</dt><dd>{task.mandate.mandateId} · v{task.mandate.version} · {task.mandate.status}</dd></div><div><dt>서버 한도 / 남은 예산</dt><dd>{formatFusdc(task.mandate.maxAmountBaseUnits)} / {formatFusdc(task.mandate.remainingBaseUnits)}</dd></div><div><dt>서버 자산 / 체인</dt><dd>{task.mandate.asset.tokenAddress} · {task.mandate.asset.chainId}</dd></div><div><dt>기한</dt><dd>{new Date(task.mandate.expiresAt).toLocaleString("ko-KR")}</dd></div></dl>
      <div className="api-actions"><button className="button secondary" disabled={busy || stopped || task.status !== "AWAITING_APPROVAL"} onClick={() => void run(async () => { const q = await tasks.quotes(task.taskId); if (mounted.current && !stopLock.current && q.mandateVersion === task.mandate.version) { setQuotes(q.quotes); setQuoteVersion(q.mandateVersion); } })}>서버 약국 견적 조회</button><button className="button primary" disabled={busy || stopped || task.status !== "AWAITING_APPROVAL"} onClick={() => void run(async () => { const result = await tasks.proposal(task.taskId); if (!mounted.current || stopLock.current) return; setNotice(`AI 서버 결과: ${result.proposal.status} · ${result.proposal.reasonCode ?? ""} / 정책: ${result.attempt?.policy.decision ?? "미판정"}. 승인 아님`); accept(await tasks.get(task.taskId)); })}>Kiln 제안 요청 · 비용 발생 가능</button><button className="button secondary" disabled={busy || stopped} onClick={() => { setError(""); setPoll(true); }}>상태 조회 재개</button><button className="button danger" disabled={stopped} onClick={() => void stop()}>에이전트 즉시 중단(STOP)</button></div>
      <p className="form-note">이 서버의 약국 결과는 시뮬레이터입니다. 수취 주소는 서버 설정값이며 실제 지급 가능 주소로 검증됐다는 뜻이 아닙니다. 수동 후보 선택을 AI 선택으로 표시하지 않습니다.</p>
      <div className="pharmacy-grid">{(quoteVersion === task.mandate.version ? quotes : []).map(q => <Card key={q.quoteId}><h3>{q.merchantName}</h3><p>{q.itemName}</p><p>{formatFusdc(q.totalAmountBaseUnits)}</p><p className="form-note">{q.quoteId} · {q.evidenceMode}<br />유효 기한: {new Date(q.expiresAt).toLocaleString("ko-KR")}</p></Card>)}</div>
      {task.attempts.map(a => <Card key={a.attemptId}><div className="section-heading"><h3>{a.merchantId} · {a.policy.decision}</h3><span className="tag">{a.status}</span></div><p>{a.policy.reasonCode} {a.policy.message?.ko}</p><p>{formatFusdc(a.amountBaseUnits)} · 지급 상태: {a.payment.status}</p><p className="form-note">{a.payment.txHash ? `서버 보고 해시: ${a.payment.txHash} · 영수증/이행 검증은 별도` : "거래 해시 없음 · 이것만으로 no-broadcast 증명을 대신하지 않습니다."}</p></Card>)}
      <button className="button primary" disabled>Mandate 확인 및 위임 승인 · 체인 계약 정렬 대기</button>
      <h3>서버 이벤트 · {poll ? "5초 간격 조회" : "조회 중지"}</h3><ol className="purchase-events">{events.map(e => <li key={e.seq}><div><strong>{e.kind} · {e.state}</strong><p>{e.reasonCode} · {e.actor}</p><time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString("ko-KR")}</time></div></li>)}</ol>
    </>}
  </>;
}
