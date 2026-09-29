"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock3, LockKeyhole, Pill, ShieldCheck, Wallet } from "lucide-react";
import { Card, MockBadge } from "./ui";
import { DemoEvidence } from "./demo-evidence";
import { PurchaseAuthorizationGuide } from "./purchase-authorization-guide";
import { TaskWorkspace } from "./task-workspace";
import { VoiceGuide } from "./voice-guide";
import { useWallet } from "./wallet-provider";
import { exceedsPreviewBudget, formatFusdc, pharmacyBudget, pharmacyQuotes, quoteSubtotal, previewBlockReason } from "@/lib/pharmacy-preview";

export function PharmacyPreview() {
  const { auth } = useWallet();
  const [selected, setSelected] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [events, setEvents] = useState<{ text: string; at: string }[]>([]);
  const quote = pharmacyQuotes.find(q => q.id === selected);
  function record(text: string) { setEvents(old => [...old, { text, at: new Date().toISOString() }]); }
  function select(id: string) {
    if (stopped || selected === id) return;
    setSelected(id); setReviewed(false);
    const next = pharmacyQuotes.find(q => q.id === id)!;
    record(`${next.merchant} 데모 견적 선택${reviewed ? " · 이전 검토 확인 해제" : ""} · ${previewBlockReason(next)}`);
  }
  return <div className="purchase-studio">

    <div className="dashboard-title"><div><span className="eyebrow">YOUR PURCHASE, YOUR CONTROL</span><h1>필요한 구매, 명확한 선택<span>.</span></h1><p>조건을 비교하고, 선택한 구매 한 건만 검토하세요.</p></div><MockBadge /></div>
    <nav className="studio-nav" aria-label="구매 화면 바로가기"><a href="#pharmacy-quotes">약국 비교</a><a href="#pharmacy-review">구매 검토</a><a href="#server-task">서버 연결</a><a href="#pharmacy-policy">시나리오 체험</a><a href="#pharmacy-evidence">증거 확인</a></nav>
    <section className="purchase-overview" id="pharmacy-request" aria-label="데모 구매 요약">
      <div className="request-lead"><span className="studio-icon"><Pill size={30} aria-hidden="true" /></span><div><span className="eyebrow">PURCHASE REQUEST · 데모</span><h2>처방받은 의약품, 오늘 배송</h2><p>3곳의 후보를 예산과 판매처 조건으로 비교합니다.</p></div></div>
      <div className="overview-metrics"><div><Wallet size={20} aria-hidden="true" /><span>최대 예산</span><strong>60 <small>fUSDC</small></strong></div><div><Clock3 size={20} aria-hidden="true" /><span>배송 목표</span><strong>오늘 <small>미확정</small></strong></div><div><ShieldCheck size={20} aria-hidden="true" /><span>지출 권한</span><strong>비활성 <small>연결 전</small></strong></div></div>
      <details className="studio-details"><summary>구매 조건과 데모 범위</summary><p>후보는 로컬 데모입니다. 서버 데이터는 별도 영역에서 표시됩니다. 예산은 상품·배송·사용자 부담 수수료 전체를 포함하며, 실제 ISO 기한·수수료·배송·허용 수신 주소는 미확정입니다.</p><p>진단·처방 및 약품·용량 변경은 하지 않습니다. 실제 처방전·신분증·주소를 입력하거나 업로드하지 마세요.</p></details>
    </section>
    <ol className="purchase-stepper" aria-label="로컬 데모 진행"><li className="active"><span>1</span>후보 비교</li><li className={quote ? "active" : ""}><span>2</span>조건 검토</li><li className={reviewed && !stopped ? "active" : ""}><span>3</span>데모 검토 확인</li><li><LockKeyhole size={18} aria-hidden="true" />결제 연결 전</li></ol>
    <section aria-labelledby="pharmacy-quotes" className="pharmacy-section"><div className="section-heading"><div><span className="eyebrow">COMPARE OPTIONS</span><h2 id="pharmacy-quotes">내 조건에 맞는 약국 찾기</h2></div><span className="tag">3개 데모 후보 · AI 추천 아님</span></div>
      <div className="pharmacy-grid">{pharmacyQuotes.map((q, index) => {
        const blocked = exceedsPreviewBudget(q) || !q.recipientAllowed;
        return <Card key={q.id} className={"quote-card " + (selected === q.id ? "pharmacy-selected" : "")}><div className="quote-heading"><span className="merchant-monogram" aria-hidden="true">{String.fromCharCode(65 + index)}</span><div><h3>{q.merchant}</h3><span className={blocked ? "quote-state blocked" : "quote-state"}>{blocked ? "조건 불일치" : "검토 가능 · 데모"}</span></div>{selected === q.id && <Check className="selection-check" aria-label="선택됨" />}</div>
          <div className="quote-price">{formatFusdc(quoteSubtotal(q)).split(" ")[0]}<span>fUSDC</span></div><p className="quote-caption">상품 + 배송 소계 · 수수료 미포함</p>
          <dl className="purchase-details"><div><dt>의약품</dt><dd>{formatFusdc(q.medicationBaseUnits)}</dd></div><div><dt>배송</dt><dd>{formatFusdc(q.deliveryBaseUnits)}</dd></div></dl>
          <div className={"quote-policy " + (blocked ? "blocked" : "")}><ShieldCheck size={18} aria-hidden="true" /><span>{exceedsPreviewBudget(q) ? "예산 60 fUSDC 초과" : !q.recipientAllowed ? "허용되지 않은 수신자" : "예산 내 후보 · 최종 검증 필요"}</span></div>
          <button className={"button " + (selected === q.id ? "primary" : "secondary")} aria-pressed={selected === q.id} disabled={stopped} onClick={() => select(q.id)}>{q.merchant} 검토<ArrowRight size={18} aria-hidden="true" /></button>
          <details className="studio-details"><summary>조건 상세</summary><p>{previewBlockReason(q)}</p><p>{q.requiresIdentity ? "처방전 + 신원 확인" : "처방전"} · 실제 재고·배송·수신 주소 미검증</p></details>
        </Card>;
      })}</div>
    </section>
    <VoiceGuide />
    <div className="review-layout">
    <Card id="pharmacy-review"><div className="section-heading"><h2>선택한 구매 검토</h2><span className="tag">{stopped ? "STOPPED · 로컬" : reviewed ? "데모 검토 확인됨" : "검토 대기"}</span></div>{quote ? <>
      <dl className="purchase-details"><div><dt>선택 후보</dt><dd>{quote.merchant} · {quote.id} (데모 ID)</dd></div><div><dt>예산 / 소계</dt><dd>{formatFusdc(pharmacyBudget)} / {formatFusdc(quoteSubtotal(quote))}</dd></div><div><dt>수수료 포함 최종 총액</dt><dd>미확정 · 실행 불가</dd></div><div><dt>AI 제안</dt><dd>연결 전 · 사용자 수동 선택이며 AI 추천 아님</dd></div><div><dt>정책 결과</dt><dd>{previewBlockReason(quote)}</dd></div><div><dt>Mandate / Task Account</dt><dd>미생성 · 승인 버전·수신 주소·권한 증거 없음</dd></div></dl>
      <div className="api-actions"><button className="button secondary" disabled={reviewed || stopped || (exceedsPreviewBudget(quote) || !quote.recipientAllowed)} onClick={() => { if (reviewed || stopped || exceedsPreviewBudget(quote) || !quote.recipientAllowed) return; setReviewed(true); record(`${quote.merchant} 데모 검토 확인 · 위임 승인 아님`); }}>데모 검토 확인</button><button className="button primary" disabled>Mandate 확인 및 위임 승인 · 연결 전</button></div>
    </> : <p>약국 후보를 선택하면 조건과 미확정 항목을 확인할 수 있습니다.</p>}<p className="form-note">후보 변경 시 이전 검토 확인은 해제됩니다. 고정 수신자 Task Account에서는 판매처 변경 후 새로운 승인·권한이 필요합니다. 검토 버튼이나 로그인만으로 지출 권한이 생기지 않습니다.</p><button className="button danger" disabled={stopped} onClick={() => { if (stopped) return; setStopped(true); setReviewed(false); record("STOPPED · 사용자가 로컬 검토 중단 · 서버 작업 ID 없음 · 원격 취소/권한 폐기 아님"); }}>로컬 검토 중단(STOP)</button></Card>
    <Card className="purchase-status"><div className="section-heading"><h2>Payment & fulfillment</h2><span className="tag">실행 연결 전</span></div><dl className="purchase-details"><div><dt>사용자 인증</dt><dd>{auth.session ? "Authenticated · 서버 검증된 로그인" : "미인증 · 지갑 연결과 별개"}</dd></div><div><dt>Mandate 승인</dt><dd>미승인 · 실제 승인 API 연결 전</dd></div><div><dt>지출 권한</dt><dd>비활성 · 사용자 서명/서버 권한 증거 없음</dd></div><div><dt>결제 상태</dt><dd>미실행 · 트랜잭션 없음</dd></div><div><dt>이행 상태</dt><dd>미검증 · 약국 주문/배송 증거 없음</dd></div><div><dt>완료 상태</dt><dd>미완료 · 결제 성공만으로 완료 처리하지 않음</dd></div></dl><p className="form-note">입금은 지출 승인이 아닙니다. Task Account 충전·실행 지갑의 가스·잔액 반환은 연결 전입니다. 결과 불명 거래는 서버 확인 전 자동 재시도하지 않습니다.</p><Link href="/login" className="text-link">지갑 로그인 확인 ↗</Link></Card>
    </div><Card className="pharmacy-section"><div className="section-heading"><h2>Recent activity</h2><span className="tag">로컬 기록 · 새로고침 시 초기화</span></div>{events.length ? <ol className="purchase-events">{events.map((event, i) => <li key={i}><div><strong>{event.text}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString("ko-KR")}</time></div></li>)}</ol> : <p>아직 후보 검토 기록이 없습니다.</p>}<p className="form-note">이 기록은 실제 정책 엔진의 DENY/no-broadcast 증거가 아닙니다.</p></Card>
    <TaskWorkspace />
    <PurchaseAuthorizationGuide />
    <DemoEvidence />
    <Link href="/dashboard" className="text-link">기존 구매 데모와 AI 초안 보기 ↗</Link>
  </div>;
}
