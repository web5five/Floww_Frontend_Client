"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink } from "lucide-react";
import { tasks } from "@/lib/api/task-client";
import { accountProgress, type AccountEvidence as Evidence } from "@/lib/api/account-evidence";
import { formatFusdc } from "@/lib/pharmacy-preview";

export function AccountEvidence({ taskId, taskStatus }: { taskId: string; taskStatus: string }) {
  const [account, setAccount] = useState<Evidence | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function refresh() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(""); setAccount(null);
    try { const next = await tasks.account(taskId, controller.signal); if (!controller.signal.aborted) setAccount(next); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "조회 실패"); }
    finally { request.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  const progress = account ? accountProgress(account, taskStatus) : null;
  return <section className="account-evidence" aria-label="서버 결제 증거"><div className="section-heading"><h3>Payment & evidence</h3><button className="button secondary" disabled={busy} onClick={() => void refresh()}>{busy ? "증거 조회 중" : "서버 결제 증거 조회"}</button></div>
    {error && <p role="alert">{error}</p>}
    {!account && !error && <p className="form-note">선택한 작업의 서버 기록을 조회하세요. 팀의 검증 예시 거래는 이 작업에 사용하지 않습니다.</p>}
    {account && progress && <><p role="status">{progress.completed ? "서버 결제·이행 검증 완료 · Task COMPLETED" : "서버 증거 확인 중 · 완료 미확정"} · {account.state}</p><p>{formatFusdc(account.amountBaseUnits)} · Sepolia</p>
      <div className="evidence-grid">{[["결제 영수증", progress.paid], ["이행 확인", progress.fulfilled], ["Task 완료", progress.completed]].map(([name, done]) => <div className="evidence-item" key={String(name)}>{done ? <CheckCircle2 size={20} aria-hidden="true" /> : <Clock3 size={20} aria-hidden="true" />}<div><strong>{name}</strong><small>{done ? "서버 검증됨" : "검증 대기"}</small></div></div>)}</div>
      <p className="form-note">{account.fulfillmentEvidenceMode === "local_pharmacy_simulator" ? "약국 수령 결과는 시뮬레이션입니다. 실제 의약품 배송을 의미하지 않습니다." : `이행 증거 방식: ${account.fulfillmentEvidenceMode ?? "미확인"}`}</p>
      <div className="api-actions">{[["결제 거래", account.paymentTxHash], ["이행 거래", account.fulfillmentTxHash]].map(([label, hash]) => hash ? <a className="text-link" key={label} href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={16} aria-hidden="true" /></a> : <span className="tag" key={label}>{label} 해시 없음</span>)}</div>
      <details className="studio-details"><summary>작업·계정·검증 시각</summary><p>Task: {account.taskId}</p><p>계정: {account.accountAddress ?? "미배포"}</p><p>토큰: {account.tokenAddress}</p><p>결제: {account.paymentOperationState ?? "미실행"} · {account.paymentVerifiedAt ? new Date(account.paymentVerifiedAt).toLocaleString("ko-KR") : "검증 시각 없음"}</p><p>이행: {account.fulfillmentOperationState ?? "미실행"} · {account.fulfillmentVerifiedAt ? new Date(account.fulfillmentVerifiedAt).toLocaleString("ko-KR") : "검증 시각 없음"}</p></details>
      <p className="form-note">해시만으로 성공을 판단하지 않습니다. UNKNOWN은 기존 거래의 서버 대조 확인이 필요하며 이 화면은 재결제를 요청하지 않습니다.</p></>}
  </section>;
}
