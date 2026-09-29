"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { backend, eventReason, reasonText } from "@/lib/api/backend-client";
import type { Conversation, DraftResponse, EvidencePage, Execution, ExecutionEvent, TestMandate } from "@/lib/api/backend-types";
import { PurchaseForm } from "./purchase-form";
import { Card } from "./ui";
import { displayDate } from "@/lib/purchase-demo";
import { useWallet } from "./wallet-provider";
import Link from "next/link";

const labels = { CREATED: "테스트 실행 준비", RUNNING: "실행 중", REVIEWED: "테스트 실행 검토 완료", REJECTED: "정책 차단", FAILED: "오류" };
type StopRecord = { id: string; at: string; reason: string };
// Session memory only, shared across client navigation. Never contains credentials.
const stoppedTasks = new Map<string, StopRecord>();
const attemptedRuns = new Set<string>();
function restoreStops() {
  try {
    const records: StopRecord[] = JSON.parse(sessionStorage.getItem("floww-local-stops") ?? "[]");
    for (const record of records) if (typeof record.id === "string" && typeof record.at === "string" && typeof record.reason === "string") stoppedTasks.set(record.id, record);
    const runs: string[] = JSON.parse(sessionStorage.getItem("floww-attempted-runs") ?? "[]");
    for (const id of runs) if (typeof id === "string") attemptedRuns.add(id);
  } catch { /* In-memory guard still applies when browser storage is unavailable. */ }
}
function Json({ value }: { value: unknown }) { return <pre className="api-json">{JSON.stringify(value, null, 2)}</pre>; }
export function BackendWorkspace({ configured }: { configured: boolean }) {
  const { auth } = useWallet();
  if (auth.enabled && (!auth.session || !auth.businessReady)) return <details className="card mandate-form-card api-workspace" id="backend-workspace"><summary>백엔드 API 연결</summary><p className="form-note">{!auth.session ? "지갑 로그인 후 사용할 수 있습니다." : "지갑 로그인 완료 · 업무 API의 JWT 인증 연결 전입니다. 구매·실행 요청은 아직 보내지 않습니다."}</p><Link className="text-link" href="/login">지갑 로그인 확인 ↗</Link></details>;
  return <Workspace key={auth.session?.identity.address ?? "development"} configured={configured} />;
}
function Workspace({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState(configured ? "백엔드 연결 상태 미확인" : "백엔드 연결 설정 필요");
  const [connectionData, setConnectionData] = useState<unknown>(null);
  const [conversation, setConversation] = useState<Conversation>([]);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [reviewNotice, setReviewNotice] = useState(false);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const currentId = useRef<string | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [stops, setStops] = useState<StopRecord[]>([]);
  const [records, setRecords] = useState<Execution[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [evidence, setEvidence] = useState<EvidencePage[]>([]);
  const createAttempt = useRef<{ body: string; key: string } | null>(null);
  const stopped = !!execution && stoppedTasks.has(execution.id);

  useEffect(() => () => { controller.current?.abort(); generation.current++; }, []);
  // GET-only polling. Cursor pages are drained even after a terminal status.
  useEffect(() => {
    if (!execution || stopped) return;
    const id = execution.id;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let after = 0;
    const poll = async () => {
      try {
        const [state, page] = await Promise.all([backend.get(id, abort.signal), backend.events(id, after, abort.signal)]);
        if (abort.signal.aborted || stoppedTasks.has(id) || currentId.current !== id) return;
        if (!Number.isSafeInteger(page.nextCursor) || page.nextCursor < after || (page.hasMore && page.nextCursor === after) || state.id !== id || !(state.status in labels)) throw new Error("서버 응답 상태 또는 이벤트 커서를 확인해 주세요.");
        setExecution(state);
        setEvents(previous => [...new Map([...previous, ...page.events].map(e => [e.seq, e])).values()].sort((a, b) => a.seq - b.seq));
        after = page.nextCursor;
        if (page.hasMore || ["CREATED", "RUNNING"].includes(state.status)) timer = setTimeout(poll, page.hasMore ? 50 : 2000);
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "조회 오류"); }
    };
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
    // Only selection and STOP restart/terminate polling, not each status update.
  }, [execution?.id, stopped, selectionRevision]); // eslint-disable-line react-hooks/exhaustive-deps

  async function perform(action: (signal: AbortSignal, active: () => boolean) => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const serial = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    const active = () => !abort.signal.aborted && generation.current === serial;
    try { await action(abort.signal, active); }
    catch (e) { if (active()) setError(e instanceof Error ? e.message : "요청 오류"); }
    finally { if (generation.current === serial) { lock.current = false; setBusy(false); } }
  }
  function select(value: Execution) {
    if (!(value.status in labels)) throw new Error("알 수 없는 서버 상태입니다. 완료로 처리하지 않습니다.");
    restoreStops();
    if (currentId.current !== value.id) { setEvents([]); setEvidence([]); }
    currentId.current = value.id; setExecution(value); setStops([...stoppedTasks.values()]); setSelectionRevision(v => v + 1);
  }
  function ask(content: string, followup = false) {
    const next: Conversation = followup ? [...conversation, { role: "assistant", content: draft!.issues.map(i => i.question).join("\n") }, { role: "user", content }] : [{ role: "user", content }];
    if (next.length > 12 || next.some(m => !m.content.trim() || m.content.length > 4000) || next.reduce((sum, m) => sum + m.content.length, 0) > 16000) { setError("대화는 12개 메시지, 메시지당 4,000자, 총 16,000자 이내여야 합니다. 새 요청으로 시작해 주세요."); return; }
    void perform(async (signal, active) => {
      const result = await backend.draft(next, signal);
      if (!active()) return;
      if (result.httpContractVersion !== "ai-draft-http.v1" || !["NEEDS_CLARIFICATION", "READY_FOR_REVIEW"].includes(result.status) || !Array.isArray(result.issues) || (result.status === "READY_FOR_REVIEW" && !result.draft) || (result.draft?.maximumTotalCost && typeof result.draft.maximumTotalCost.amount !== "string")) throw new Error("지원하지 않는 초안 응답입니다. 승인으로 처리하지 않습니다.");
      setConversation(next); setDraft(result); setAnswer(""); setReviewNotice(false);
    });
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (execution || lock.current) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const mandate: TestMandate = { goal: value("goal"), itemId: value("itemId"), recipient: value("recipient"), maxTotal: value("maxTotal"), currency: "TEST_USDC", expiresAt: new Date(value("expiresAt")).toISOString() };
    const body = JSON.stringify(mandate);
    if (!createAttempt.current) {
      try { createAttempt.current = JSON.parse(sessionStorage.getItem("floww-test-create") ?? "null"); } catch { /* Memory fallback. */ }
    }
    if (!createAttempt.current || createAttempt.current.body !== body) createAttempt.current = { body, key: crypto.randomUUID() };
    try { sessionStorage.setItem("floww-test-create", JSON.stringify(createAttempt.current)); } catch { /* Memory fallback. */ }
    const key = createAttempt.current.key;
    void perform(async (signal, active) => { const result = await backend.create(mandate, key, signal); if (active()) select(result); });
  }
  function stop() {
    if (!execution || stoppedTasks.has(execution.id)) return;
    const record = { id: execution.id, at: new Date().toISOString(), reason: "사용자 STOP · 이 브라우저의 추가 승인·거절·재실행 요청 금지" };
    stoppedTasks.set(execution.id, record);
    try { sessionStorage.setItem("floww-local-stops", JSON.stringify([...stoppedTasks.values()])); } catch { /* Memory fallback. */ }
    controller.current?.abort(); generation.current++; lock.current = false; setBusy(false); setStops([...stoppedTasks.values()]);
  }
  function startRun() {
    if (!execution || lock.current) return;
    const id = execution.id;
    if (stoppedTasks.has(id) || attemptedRuns.has(id) || execution.status !== "CREATED") return;
    attemptedRuns.add(id);
    try { sessionStorage.setItem("floww-attempted-runs", JSON.stringify([...attemptedRuns])); } catch { /* Memory fallback. */ }
    void perform(async (signal, active) => {
      const value = await backend.run(id, signal);
      if (active() && !stoppedTasks.has(id) && currentId.current === id) {
        if (value.id !== id) throw new Error("실행 ID가 일치하지 않습니다.");
        setExecution(value);
      }
    });
  }
  function newTest() {
    currentId.current = null; setExecution(null); setEvents([]); setEvidence([]); createAttempt.current = null;
    try { sessionStorage.removeItem("floww-test-create"); } catch { /* Memory fallback. */ }
  }
  async function loadEvidence() {
    if (!execution) return;
    const id = execution.id;
    await perform(async (_, active) => {
      const pages: EvidencePage[] = [];
      let after = 0;
      do {
        const page = await backend.evidence(id, after);
        if (!active()) return;
        pages.push(page);
        if (!page.events.hasMore) break;
        if (page.nextCursor <= after || pages.length >= 100) throw new Error("증거 페이지 범위를 확인해 주세요. 다운로드를 완료하지 않았습니다.");
        after = page.nextCursor;
      } while (true);
      if (active()) setEvidence(pages);
    });
  }
  const fields = draft?.draft;
  return <details className="card mandate-form-card api-workspace" id="backend-workspace" onToggle={event => { if (event.target === event.currentTarget && event.currentTarget.open) { restoreStops(); setStops([...stoppedTasks.values()]); } }}>
    <summary><span>Floww_Server 연결</span><span className="tag">API · 데모와 별도</span></summary>
    <p className="form-note">클라이언트 담당 범위: AI 초안 → 테스트 실행 조회 → 이벤트·증거. 실제 위임·구매·서명·지급·블록체인은 연결하지 않습니다.</p>
    <div className="api-actions"><button className="button secondary" disabled={busy} onClick={() => void perform(async (_, active) => { const health = await backend.health(); const readiness = await backend.readiness(); if (active()) { setConnection("서버 응답 수신 · 설정값은 실제 통합 성공 증거가 아닙니다."); setConnectionData({ health, readiness }); } })}>연결 상태 확인</button><span role="status">{connection}</span></div>
    {connectionData !== null && <Json value={connectionData} />}
    {error && <p role="alert" className="form-error">{error}</p>}
    {busy && <p role="status">요청 처리 중 · 중복 요청 금지</p>}
    <h2>요청 입력</h2>
    <PurchaseForm locked={busy} onDraft={content => ask(content)} />
    {draft?.status === "NEEDS_CLARIFICATION" && <Card><h2>추가 질문 필요</h2><ul>{draft.issues.map((issue, i) => <li key={i}>{issue.question}</li>)}</ul><form onSubmit={e => { e.preventDefault(); ask(answer, true); }}><label className="field">추가 답변<textarea required maxLength={4000} value={answer} onChange={e => setAnswer(e.target.value)} disabled={busy} /></label><button className="button primary" disabled={busy || !answer.trim()}>답변 추가 및 초안 재요청 (비용 발생 가능)</button></form></Card>}
    {draft?.status === "READY_FOR_REVIEW" && fields && <Card><h2>Mandate 검토 대기</h2><p className="form-note">READY_FOR_REVIEW는 검토 가능한 초안이며 승인 완료가 아닙니다.</p><dl className="purchase-details">{[
      ["목적", fields.objective], ["품목 범위", fields.itemScope], ["판매처 조건", fields.providerCriteria], ["최대 총비용", fields.maximumTotalCost?.amount], ["자산", fields.maximumTotalCost?.asset], ["모든 사용자 수수료 포함", fields.maximumTotalCost ? fields.maximumTotalCost.includesAllUserPaidFees === true ? "포함" : fields.maximumTotalCost.includesAllUserPaidFees === false ? "미포함" : "미확정" : "미확정"], ["기한", fields.deadline ? displayDate(fields.deadline) : null], ["이행 조건", fields.fulfillmentCriterion],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "미확정"}</dd></div>)}</dl><h3>불확실성 및 확인 사항</h3>{draft.issues.length ? <ul>{draft.issues.map((i, n) => <li key={n}>{i.question} ({i.code})</li>)}</ul> : <p className="form-note">서버가 반환한 issues 없음 · 상품 구매나 이행 보증은 아닙니다.</p>}<button className="button primary" disabled={busy || stopped} onClick={() => setReviewNotice(true)}>Mandate 확인 및 위임 승인</button><p className="form-note">위임 승인 API는 제안 상태입니다. 이 버튼은 안내만 표시하며 승인 요청을 전송하지 않습니다.</p>{reviewNotice && <p role="status">초안 확인만 했습니다. 실제 위임 승인·결제는 연결 전입니다.</p>}</Card>}
    {draft && <details><summary>AI evidence · 서버 응답</summary><Json value={draft.evidence} /></details>}
    <details className="api-test"><summary>테스트 실행 준비 (구매·서명·지급 효과 없음)</summary><p className="form-note">초안을 자동 실행하지 않습니다. 서버 팀이 제공한 테스트 상품·판매처 ID로 별도 입력합니다. TEST_USDC는 USDC와 다릅니다. 실행 시작 시 모델 비용이 발생할 수 있습니다.</p><form className="purchase-form" onSubmit={create}><fieldset disabled={busy || !!execution}><div className="form-grid"><label className="field">테스트 목적<input name="goal" required maxLength={500} /></label><label className="field">테스트 상품 ID<input name="itemId" required pattern="[A-Za-z0-9._:\-]{1,128}" /></label><label className="field">테스트 판매처 ID<input name="recipient" required pattern="[A-Za-z0-9._:\-]{3,128}" /></label><label className="field">최대 총액 (TEST_USDC)<input name="maxTotal" inputMode="decimal" required pattern="[0-9]{1,12}(\.[0-9]{1,8})?" /></label><label className="field">테스트 기한<input name="expiresAt" type="datetime-local" required /></label></div><label><input type="checkbox" required /> 테스트 요청이며 실제 위임 승인이 아님을 확인합니다.</label><div className="api-actions"><button className="button primary">테스트 실행 생성</button></div></fieldset></form>{execution && <p className="form-note">현재 실행을 조회 중입니다. 새 테스트를 만들려면 아래에서 새 테스트 입력을 선택하세요.</p>}</details>
    <div className="api-actions"><button className="button secondary" disabled={busy} onClick={() => void perform(async (_, active) => { const result = await backend.list(); if (active()) { setRecords(result); setHasMore(false); } })}>최근 실행 조회</button><button className="button secondary" disabled={busy} onClick={() => void perform(async (_, active) => { const result = await backend.history(); if (active()) { setRecords(result.executions); setCursor(result.nextCursor); setHasMore(result.hasMore); } })}>실행 이력 조회</button>{hasMore && <button className="button secondary" disabled={busy || !cursor} onClick={() => void perform(async (_, active) => { const result = await backend.history(cursor!); if (active()) { setRecords(v => [...v, ...result.executions]); setCursor(result.nextCursor); setHasMore(result.hasMore); } })}>이력 더 보기</button>}</div>
    <ul className="api-records">{records.map(r => <li key={r.id}><button className="text-link" disabled={busy} onClick={() => select(r)}>{r.id} · {labels[r.status] ?? r.status}</button></li>)}</ul>
    {execution && <Card><div className="section-heading"><h2>Your approval · API 테스트</h2><span className="tag">{stopped ? "STOPPED · 로컬" : `${execution.status} · ${labels[execution.status]}`}</span></div><p className="form-note">작업 ID: {execution.id}<br />서버 상태 수신 시각: {displayDate(execution.updatedAt)}<br />결제 연결 전 · REVIEWED는 결제 완료가 아닙니다.</p><Json value={execution.mandate} /><div className="api-actions"><button className="button primary" disabled={busy || stopped || execution.status !== "CREATED" || attemptedRuns.has(execution.id)} onClick={startRun}>테스트 실행 시작 (비용 발생 가능)</button><button className="button danger" disabled={stopped} onClick={stop}>에이전트 즉시 중단(STOP)</button><button className="button secondary" disabled={busy} onClick={() => void perform(async (signal, active) => { const value = await backend.get(execution.id, signal); if (active()) select(value); })}>서버 상태 다시 조회</button></div><p className="form-note">STOP은 현재 브라우저의 추가 요청을 막습니다. 원격 취소 API가 없어 이미 시작된 서버 실행의 중단은 보장하지 않습니다. 요청 응답이 유실되어도 실행 시작을 자동 재시도하지 않습니다.</p><button className="text-link" disabled={busy} onClick={newTest}>새 테스트 입력 (별도 작업 · STOP 기록 유지)</button>
    <h3>Recent activity · 서버 events</h3><ol className="purchase-events">{events.map(event => { const code = eventReason(event.payload); return <li key={event.seq}><div><strong>{event.kind}</strong><time dateTime={event.createdAt}>{displayDate(event.createdAt)}</time><small>{execution.id} · seq {event.seq}</small>{code && <p>{code} · {reasonText(code)}</p>}<details><summary>이벤트 상세</summary><Json value={event.payload} /></details></div></li>; })}</ol>{execution.status === "REJECTED" && !events.some(e => typeof e.payload.reasonCode === "string") && <p role="status">정책 차단 · 차단 사유를 events에서 조회 중이거나 서버 응답에 사유가 없습니다.</p>}
    <h3>감사 기록 및 evidence</h3><button className="button secondary" disabled={busy} onClick={() => void loadEvidence()}>evidence JSON 조회</button>{evidence.length > 0 && <><p className="form-note">서버 증거 {evidence.length}페이지 · complete는 증거 수집 범위이며 구매·결제 완료가 아닙니다.</p><button className="button secondary" onClick={() => { const blob = new Blob([JSON.stringify({ source: "Floww_Server", pages: evidence }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `floww-evidence-${execution.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>evidence JSON 다운로드</button><Json value={evidence} /></>}</Card>}
    {stops.length > 0 && <Card><h3>Recent activity · 로컬 STOP 기록</h3><ol className="purchase-events">{stops.map(s => <li key={s.id}><div><strong>STOPPED</strong><p>{s.id} · {s.reason}</p><time dateTime={s.at}>{displayDate(s.at)}</time></div></li>)}</ol></Card>}
  </details>;
}
