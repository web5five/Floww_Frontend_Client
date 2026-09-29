"use client";
import { useReducer } from "react";
import { Card, MockBadge } from "./ui";
import { initialRehearsal, rehearsalReducer, requiredEvidence, type RehearsalScenario } from "@/lib/demo-evidence";

export function DemoEvidence() {
  const [state, dispatch] = useReducer(rehearsalReducer, initialRehearsal);
  const act = (type: "check" | "review" | "stop") => dispatch({ type, at: new Date().toISOString() });
  function download() {
    const blob = new Blob([JSON.stringify({ source: "LOCAL_REHEARSAL_NOT_SERVER_EVIDENCE", taskId: null, ...state, walletSigningRequested: false, transactionBroadcastRequested: false, transactionHash: null, serverNoBroadcastVerified: false, requiredEvidence: requiredEvidence.map(name => ({ name, verified: false })) }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "floww-local-rehearsal.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <Card id="pharmacy-policy" className="pharmacy-section">
      <div className="section-heading"><h2>정상·차단 시나리오 리허설</h2><MockBadge /></div>
      <p className="form-note">아래는 모든 조건을 가정한 독립 로컬 테스트입니다. 위 약국의 실제 정책 판정이나 사용자 위임 승인이 아닙니다. 서버 작업을 생성하거나 지갑 서명·결제를 요청하지 않습니다.</p>
      <fieldset disabled={state.status === "STOPPED"} className="api-actions"><legend>데모 시나리오 선택</legend>{([
        ["normal", "정상 조건 · 약국 A 고정 견적 23.5 fUSDC"], ["over-budget", "예산 초과 · 약국 B 견적 64 fUSDC"], ["wrong-recipient", "잘못된 수신자 · 약국 C 견적 19 fUSDC"],
      ] as [RehearsalScenario, string][]).map(([value, label]) => <label className="field" key={value}><span><input type="radio" name="rehearsal" checked={state.scenario === value} onChange={() => dispatch({ type: "select", scenario: value })} /> {label}</span></label>)}</fieldset>
      <div className="api-actions"><button className="button secondary" disabled={state.status !== "READY"} onClick={() => act("check")}>로컬 정책 검사</button><button className="button primary" disabled={state.status !== "ALLOW"} onClick={() => act("review")}>승인 흐름 연습 · 서명 없음</button><button className="button danger" disabled={state.status === "STOPPED"} onClick={() => act("stop")}>리허설 중단(STOP)</button></div>
      <p role="status"><strong>{state.status} · 로컬 리허설</strong>{state.status === "DENY" ? ` · ${state.scenario === "over-budget" ? "64 fUSDC가 Task 한도 60 fUSDC를 초과합니다." : "후보 수신자가 승인된 수신자와 일치하지 않습니다."}` : state.status === "REVIEWED" ? " · 실제 승인·서명·결제 미실행" : ""}</p>
      <p className="form-note">이 화면의 서명 요청 0 · 전송 요청 0 · 거래 해시 없음. 실제 서버의 no-signing / no-broadcast 증명은 연결 전입니다. STOP 이후 이 리허설은 새로고침 전까지 재실행할 수 없습니다.</p>
      <ol className="purchase-events" aria-label="리허설 기록">{state.events.map((event, index) => <li key={index}><div><strong>{event.status} · {event.reason}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString("ko-KR")}</time><p>로컬 리허설 · 서버 작업 ID 없음</p></div></li>)}</ol>
      <button className="button secondary" onClick={download}>로컬 리허설 기록 다운로드</button>
    </Card>
    <Card id="pharmacy-evidence" className="pharmacy-section"><div className="section-heading"><h2>Required demo evidence</h2><span className="tag">실제 E2E 검증 대기</span></div><p className="form-note">다음 항목은 같은 작업·Mandate 버전의 서버 증거로 확인해야 합니다. 이 리허설의 성공 표시나 로그인 상태만으로 완료 처리하지 않습니다.</p><details className="studio-details"><summary>13개 필수 증거 항목 보기 · 0개 검증</summary><div className="evidence-grid">{requiredEvidence.map((name, index) => <div className="evidence-item" key={name}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{name}</strong><small>실제 작업 증거 연결 전</small></div></div>)}</div></details><p className="form-note">결제 성공과 Task COMPLETED는 다릅니다. 영수증 확인 후에도 이행 결과와 서버 검증이 필요합니다. PAYMENT_UNKNOWN이면 대조 확인 전 재결제를 금지합니다.</p></Card>
  </>;
}
