"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, RefreshCw, ShieldCheck, ShoppingBag, Sparkles, Wallet, X, OctagonX, ClipboardList } from "lucide-react";
import { Card, EmptyState, ErrorState, LoadingState, MockBadge } from "./ui";
import { useDemoOrder } from "./demo-order-provider";
import { BackendWorkspace } from "./backend-workspace";
import { PurchaseForm } from "./purchase-form";
import { connectionNotice, fetchDashboard } from "@/lib/api/client";
import { defaultCandidate } from "@/lib/api/mock";
import { displayDate, paymentState, statusLabels, toUnits, totalPrice, usdc } from "@/lib/purchase-demo";
import type { DashboardData, DemoScenario, PurchaseRequest } from "@/lib/api/types";

const scenarios: { value: DemoScenario; label: string; detail: string }[] = [
  { value: "normal", label: "정상 시나리오", detail: "105 + 3 = 108 USDC · 허용 판매처" },
  { value: "over-budget", label: "예산 초과", detail: "119 + 3 = 122 USDC · 120 USDC 초과" },
  { value: "unapproved-merchant", label: "미승인 판매처", detail: "108 USDC · 허용 목록 밖 판매처" },
];
function Details({ rows }: { rows: [string, string][] }) {
  return <dl className="purchase-details">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export function Dashboard({ backendConfigured = false }: { backendConfigured?: boolean }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const [scenario, setScenario] = useState<DemoScenario>("normal");
  const { state, dispatch } = useDemoOrder();
  const { task, events } = state;
  const navigatedHash = useRef("");
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const delay = revision > 0 ? new Promise<void>(resolve => { timer = setTimeout(resolve, 450); }) : Promise.resolve();
    Promise.all([fetchDashboard(controller.signal), delay]).then(([result]) => {
      if (!controller.signal.aborted) { setData(result); setLoadState("ready"); }
    }).catch(() => { if (!controller.signal.aborted) setLoadState("error"); });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision]);
  useEffect(() => {
    if (loadState !== "ready") return;
    const hash = window.location.hash;
    if (!hash || navigatedHash.current === hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target) {
      if (target instanceof HTMLDetailsElement) target.open = true;
      navigatedHash.current = hash;
      target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [loadState]);
  useEffect(() => {
    if (!task || task.status !== "AWAITING_APPROVAL") return;
    let timer: ReturnType<typeof setTimeout>;
    const checkDeadline = () => {
      clearTimeout(timer);
      const remaining = Date.parse(task.request.deadline) - Date.now();
      if (remaining <= 0) dispatch({ type: "EXPIRE", taskId: task.task_id, now: Date.now() });
      else timer = setTimeout(checkDeadline, Math.min(remaining, 2147483647));
    };
    checkDeadline();
    window.addEventListener("focus", checkDeadline);
    document.addEventListener("visibilitychange", checkDeadline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", checkDeadline);
      document.removeEventListener("visibilitychange", checkDeadline);
    };
  }, [task, dispatch]);
  const decide = (decision: "APPROVED" | "REJECTED" | "CANCELLED") => {
    if (task) dispatch({ type: "DECIDE", taskId: task.task_id, decision, now: Date.now() });
  };
  const refresh = () => { setLoadState("loading"); setRevision(value => value + 1); };
  const run = (selected: DemoScenario, request?: PurchaseRequest) => dispatch({ type: "RUN", scenario: selected, request, now: Date.now(), expectedRun: state.run });
  const candidate = task?.candidate ?? data?.candidate ?? defaultCandidate;
  const maximum = task?.request.budget.maximum ?? 120;
  const total = totalPrice(candidate);
  const remaining = (toUnits(maximum) - toUnits(total)) / 100;
  const pending = task?.status === "AWAITING_APPROVAL";
  const canDecide = pending && task.judgment.allowed && task.judgment.checks.length === 4 && task.judgment.checks.every(check => check.passed);
  const execution = paymentState(task);
  const deadline = task ? displayDate(task.request.deadline) : "구매 조건에서 설정";
  return <>
    <div className="dashboard-title"><div><span className="eyebrow">CHALLENGE B · PURCHASE APPROVAL</span><h1>Purchase dashboard<span>.</span></h1><p>조건은 명확하게, 마지막 결정은 당신에게.</p></div><button onClick={refresh} disabled={loadState === "loading"} className="button secondary"><RefreshCw size={16} /> 새로고침</button></div>
    <div className="demo-banner"><MockBadge /><p role="status" aria-live="polite">{loadState === "ready" && revision > 0 ? "데모 데이터 갱신 완료 · 현재 구매 조건과 기록은 유지됩니다. " : ""}{connectionNotice} · Kiln·지갑·블록체인 연결 전. 실제 구매·결제·자산 이동은 없습니다.</p></div>
    {loadState === "loading" ? <Card><LoadingState /></Card> : loadState === "error" ? <Card><ErrorState onRetry={refresh} /></Card> : <>
      <BackendWorkspace configured={backendConfigured} />
      <div className="api-actions"><Link className="button secondary" href="/pharmacy">약국 3곳 비교 · 데모 검토 화면 ↗</Link><span>실제 위임·결제 연결 전</span></div>
      <Card className="scenario-card">
        <div className="section-heading"><h2>Challenge B demo</h2><span className="tag">로컬 시뮬레이션</span></div>
        <fieldset className="scenario-options" disabled={pending}><legend className="sr-only">데모 시나리오 선택</legend>{scenarios.map(option => <label key={option.value} className={scenario === option.value ? "scenario-option selected" : "scenario-option"}><input type="radio" name="scenario" value={option.value} checked={scenario === option.value} onChange={() => setScenario(option.value)} /><span><strong>{option.label}</strong><small>{option.detail}</small></span></label>)}</fieldset>
        <div className="scenario-footer"><p>기본 조건: Nike · 검정 · EU 45 · 최대 120 USDC · 실행 시점부터 7일. {pending ? "현재 요청을 승인·거절·중단한 뒤 다시 실행할 수 있습니다." : "다시 실행해도 이전 기록은 유지됩니다."}</p><button className="button primary" disabled={pending} onClick={() => run(scenario)}>선택한 데모 실행</button></div>
      </Card>
      <div className="dashboard-grid">
        <Card className="portfolio-card" id="purchase-budget"><div className="section-heading"><h2><Wallet size={19} /> Purchase budget</h2><span className="tag">데모 예산</span></div><p className="label">승인 예산 한도 · 지출 승인과 별개</p><div className="total-balance">{maximum.toFixed(2)} <small>USDC</small></div><div className="allocation-bar" aria-hidden="true"><span className="btc" style={{ width: `${Math.min(100, total / maximum * 100)}%` }} /><span className="usdc" style={{ flex: 1 }} /></div><Details rows={[["제안 가격", usdc(candidate.price)], ["예상 수수료", usdc(candidate.estimated_fee)], ["총액", usdc(total)], ["남은 예산 (제안 기준)", usdc(remaining)], ["구매 기한", deadline], ["현재 작업 상태", task ? statusLabels[task.status] : "구매 조건 생성 전"]]} /><p className="data-note">실제 잔액 조회·예산 예치 없음. 승인 후에도 지출되지 않습니다.</p></Card>
        <Card id="ai-insight" className="ai-card"><div className="section-heading"><h2><Sparkles size={19} /> AI purchase review</h2><span className="tag">qwen3-32b</span></div><span className="hold-pill">연결 전 · 데모 판단</span><h3>{task ? task.judgment.allowed ? "데모 조건에 맞는 구매 후보입니다." : "조건을 벗어난 제안은 멈춥니다." : "당신의 구매 기준부터 알려주세요."}</h3>{task ? <><ul className="policy-checks">{task.judgment.checks.map(check => <li key={check.key}>{check.passed ? <Check size={15} /> : <X size={15} />}<span><strong>{check.label} · {check.passed ? "충족" : "차단"}</strong><small>{check.reason}</small></span></li>)}</ul><p>{task.judgment.reasons.join(" ")}</p><div className="ai-footnote"><strong>불확실한 정보</strong><ul>{task.judgment.uncertainties.map(reason => <li key={reason}>{reason}</li>)}</ul></div></> : <p>시나리오를 실행하거나 구매 조건을 입력하면 상품·예산·판매처·기한을 비교합니다. 실제 모델 호출 없이 로컬 규칙으로 판단합니다.</p>}<p className="ai-footnote">Kiln 연결 전 · 실제 토큰·도구 호출·응답 ID 없음</p></Card>
        <Card id="purchase-mandate" className="market-card"><div className="section-heading"><h2><ClipboardList size={19} /> Purchase mandate</h2><span className="tag">구매 조건 · 데모</span></div><Details rows={[["상품 또는 목적", task?.request.intent ?? "Nike 검정 러닝화 구매"], ["브랜드 / 카테고리", `${task?.request.requirements.brand ?? "Nike"} / ${task?.request.requirements.category ?? "러닝화"}`], ["색상 / 사이즈", `${task?.request.requirements.color ?? "검정"} / EU ${task?.request.requirements.size_eu ?? 45}`], ["최대 예산", usdc(maximum)], ["구매 기한", deadline], ["승인된 판매처", task?.request.allowed_merchants.join(", ") ?? "Nike 데모 스토어"], ["작업 ID", task ? `${task.task_id} (데모 값)` : "연결 전 · 미생성"]]} /><p className="data-note">실제 task_id는 향후 Floww_Server가 생성합니다.</p><a href="#mandate-form" className="text-link" onClick={() => { const form = document.getElementById("mandate-form"); if (form instanceof HTMLDetailsElement) form.open = true; }}>구매 조건 입력 보기 ↗</a></Card>
        <Card id="purchase-approval" className="trade-card"><div className="section-heading"><h2><ShieldCheck size={19} /> Your approval</h2><span className="tag">{task ? statusLabels[task.status] : "제안 데모"}</span></div><div className="trade-summary"><span className="icon-tile"><ShoppingBag size={22} /></span><div><strong>{candidate.title} 구매 제안</strong><p>{candidate.color} · EU {candidate.size_eu} · MOCK DATA</p></div></div><Details rows={[["판매처", candidate.merchant], ["상품 가격 / 예상 수수료", `${usdc(candidate.price)} / ${usdc(candidate.estimated_fee)}`], ["총액", usdc(total)], ["남은 예산", usdc(remaining)], ["정책 검사 (실행 허가 아님)", task ? task.judgment.allowed ? "PASS · 데모 조건 충족" : "BLOCKED · 조건 위반" : "검사 전"]]} /><p className="trade-description"><strong>{task && !pending ? "결정 결과" : "선택 이유"}</strong><br />{task?.status === "APPROVED" ? "사용자 최종 승인을 기록했습니다. 승인 완료 · 테스트넷 실행 대기" : task?.status === "REJECTED" ? task.rejection?.reason : task?.status === "STOPPED" ? task.stop?.reason : task?.status === "CANCELLED" ? "사용자가 현재 작업의 전체 중단을 요청했습니다." : task?.judgment.reasons.join(" ") ?? "구매 조건을 생성하면 고정 데모 후보와 비교합니다."}<br />{task && !pending ? "현재 상태에서는 실제 결제·블록체인 실행을 하지 않습니다." : "실제 결제 전 사용자 최종 승인이 필요합니다."}</p>
        {canDecide ? <div className="trade-actions"><button className="button secondary" onClick={() => decide("REJECTED")}><X size={15} /> 거절</button><button className="button primary" onClick={() => decide("APPROVED")}><Check size={15} /> Mandate 확인 및 위임 승인</button><button className="button secondary" onClick={() => decide("CANCELLED")}><OctagonX size={15} /> 전체 중단</button></div> : task ? <div className="trade-result" role="status"><h3>{task.status === "APPROVED" ? "사용자 구매 승인을 기록했어요" : task.status === "REJECTED" ? "구매 제안을 거절했어요" : task.status === "CANCELLED" ? "현재 구매 작업을 전체 중단했어요" : task.status === "STOPPED" ? "STOPPED · 에이전트를 즉시 중단했어요" : "BLOCKED · 구매 승인이 차단되었어요"}</h3><p>테스트넷 연결 전 · 실제 결제·상품 구매·자산 이동은 없습니다.</p><a className="text-link" href="#main">다른 데모 다시 실행 ↑</a></div> : <p className="form-note">위에서 데모를 실행하거나 아래에서 구매 조건을 생성하세요. 아직 승인할 요청이 없습니다.</p>}{task?.status === "STOPPED" && <div className="trade-actions"><button className="button secondary" disabled><X size={15} /> 거절</button><button className="button primary" disabled><Check size={15} /> Mandate 확인 및 위임 승인</button></div>}{(canDecide || task?.status === "APPROVED" || task?.status === "STOPPED") && <div className="agent-stop"><button type="button" className="button danger" disabled={!task || task.status === "STOPPED"} onClick={() => { if (task) dispatch({ type: "STOP", taskId: task.task_id, now: Date.now() }); }}><OctagonX size={17} /> 에이전트 즉시 중단(STOP)</button>{task?.status === "STOPPED" && <p role="status">결제·블록체인 실행 금지. 중단된 작업은 다시 승인할 수 없습니다.<br />중단 사유: {task.stop?.reason}</p>}</div>}</Card>
      </div>
      <details className="card mandate-form-card" id="mandate-form" open={!task}><summary><ClipboardList size={19} /><span>구매 조건 직접 입력</span><span className="tag">데모 요청</span></summary><PurchaseForm key={task?.task_id ?? "initial"} request={task?.request} locked={pending} onSubmit={request => run("normal", request)} /></details>
      <Card className="evidence-card" id="purchase-evidence"><div className="section-heading"><h2><ShieldCheck size={19} /> Payment & evidence</h2><span className="tag">테스트넷 연결 전</span></div><p>사용자 승인 → 테스트넷 결제 → 증거 확인은 향후 연결할 흐름입니다. 현재는 사용자 승인 기록까지만 데모로 제공합니다.</p><Details rows={[["결제 상태", execution.label], ["구매 증거", "없음 · 실제 영수증 미수신"], ["트랜잭션", "테스트넷 연결 전"]]} /></Card>
      <Card className="activity-card"><div className="section-heading"><h2>Recent activity</h2><span className="label">시간순 · 데모 기록</span></div>{events.length === 0 ? <EmptyState title="아직 구매 활동이 없어요" description="구매 조건을 생성하거나 시나리오를 실행하면 순서대로 기록됩니다." /> : <ol className="purchase-events" aria-label="구매 활동 기록">{events.map(event => <li key={event.id}><div><strong>{event.title}</strong><p>{event.detail}</p><time dateTime={event.created_at}>{displayDate(event.created_at)}</time><small>{event.task_id} · 데모 · 테스트넷 연결 전</small></div><span className="tag">{event.status in statusLabels ? statusLabels[event.status as keyof typeof statusLabels] : event.status}</span></li>)}</ol>}</Card>
    </>}
  </>;
}
