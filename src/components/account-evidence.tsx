"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink } from "lucide-react";
import { tasks } from "@/lib/api/task-client";
import { accountProgress, type AccountEvidence as Evidence } from "@/lib/api/account-evidence";
import { formatFusdc } from "@/lib/pharmacy-preview";
import { useLocale } from "@/lib/i18n";
import { statusLabel } from "@/lib/scenario-presentation";

export function AccountEvidence({ taskId, taskStatus }: { taskId: string; taskStatus: string }) {
  const { locale, t } = useLocale();
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
  const dateLocale = locale === "ko" ? "ko-KR" : "en-US";
  return <section className="account-evidence" aria-label={t("서버 결제 증거", "Server payment evidence")}><div className="section-heading"><h3>{t("결제와 증거", "Payment and evidence")}</h3><button className="button secondary" disabled={busy} onClick={() => void refresh()}>{busy ? t("증거 조회 중", "Loading evidence") : t("서버 결제 증거 조회", "View server payment evidence")}</button></div>
    {error && <p role="alert">{t("결제 증거를 조회하지 못했습니다.", "Payment evidence could not be retrieved.")}</p>}
    {!account && !error && <p className="form-note">{t("선택한 작업의 서버 기록을 조회하세요. 팀의 검증 예시 거래는 이 작업에 사용하지 않습니다.", "View server records for the selected Task. Team verification transactions are not used for this Task.")}</p>}
    {account && progress && <><p role="status">{progress.completed ? t("서버 결제·이행 검증 완료 · 작업 완료", "Server payment and fulfillment verified · Task completed") : t("서버 증거 확인 중 · 완료 미확정", "Checking server evidence · completion unconfirmed")} · {statusLabel(account.state, locale)}</p><p>{formatFusdc(account.amountBaseUnits)} · Sepolia</p>
      <div className="evidence-grid">{[[t("결제 영수증", "Payment receipt"), progress.paid], [t("이행 확인", "Fulfillment verification"), progress.fulfilled], [t("Task 완료", "Task completed"), progress.completed]].map(([name, done]) => <div className="evidence-item" key={String(name)}>{done ? <CheckCircle2 size={20} aria-hidden="true" /> : <Clock3 size={20} aria-hidden="true" />}<div><strong>{name}</strong><small>{done ? t("서버 검증됨", "Server verified") : t("검증 대기", "Awaiting verification")}</small></div></div>)}</div>
      <p className="form-note">{account.fulfillmentEvidenceMode === "local_pharmacy_simulator" ? t("약국 수령 결과는 시뮬레이션입니다. 실제 의약품 배송을 의미하지 않습니다.", "The pharmacy receipt is simulated. It does not mean real medicine was delivered.") : `${t("이행 증거 방식:", "Fulfillment evidence mode:")} ${account.fulfillmentEvidenceMode ?? t("미확인", "Unknown")}`}</p>
      <div className="api-actions">{[[t("결제 거래", "Payment transaction"), account.paymentTxHash], [t("이행 거래", "Fulfillment transaction"), account.fulfillmentTxHash]].map(([label, hash]) => hash ? <a className="text-link" key={label} href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={16} aria-hidden="true" /></a> : <span className="tag" key={label}>{label} {t("해시 없음", "hash unavailable")}</span>)}</div>
      <details className="studio-details"><summary>{t("작업·계정·검증 시각", "Task, account, and verification times")}</summary><p>Task: {account.taskId}</p><p>{t("계정:", "Account:")} {account.accountAddress ?? t("미배포", "Not deployed")}</p><p>{t("토큰:", "Token:")} {account.tokenAddress}</p><p>{t("결제:", "Payment:")} {account.paymentOperationState ?? t("미실행", "Not run")} · {account.paymentVerifiedAt ? new Date(account.paymentVerifiedAt).toLocaleString(dateLocale) : t("검증 시각 없음", "No verification time")}</p><p>{t("이행:", "Fulfillment:")} {account.fulfillmentOperationState ?? t("미실행", "Not run")} · {account.fulfillmentVerifiedAt ? new Date(account.fulfillmentVerifiedAt).toLocaleString(dateLocale) : t("검증 시각 없음", "No verification time")}</p></details>
      <p className="form-note">{t("해시만으로 성공을 판단하지 않습니다. UNKNOWN은 기존 거래의 서버 대조 확인이 필요하며 이 화면은 재결제를 요청하지 않습니다.", "A hash alone does not prove success. UNKNOWN requires server reconciliation of the existing transaction; this view does not request another payment.")}</p></>}
  </section>;
}
