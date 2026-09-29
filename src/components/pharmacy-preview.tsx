"use client";
import { useState } from "react";
import Link from "next/link";
import { Card, MockBadge } from "./ui";
import { useWallet } from "./wallet-provider";
import { exceedsPreviewBudget, formatFusdc, pharmacyBudget, pharmacyQuotes, quoteSubtotal } from "@/lib/pharmacy-preview";

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
    record(`${next.merchant} 데모 견적 선택${reviewed ? " · 이전 검토 확인 해제" : ""}${exceedsPreviewBudget(next) ? " · BLOCKED: 상품·배송 소계만으로 예산 초과" : " · 정책 판정 대기"}`);
  }
  return <>
    <div className="dashboard-title"><div><span className="eyebrow">CHALLENGE B · PHARMACY PREVIEW</span><h1>Compare. Review. Stay in control<span>.</span></h1><p>약국 후보를 비교하고, 최종 조건과 권한을 구분해 확인하세요.</p></div><Link href="/dashboard" className="button secondary">기존 구매 데모</Link></div>
    <div className="demo-banner"><MockBadge /><p>발표 시나리오를 바탕으로 한 로컬 검토 화면입니다. 실제 약국·Kiln·결제 API는 호출하지 않습니다.</p></div>
    <Card><div className="section-heading"><h2>Purchase request · 구매 목적</h2><span className="tag">데모 조건</span></div><p>이미 처방받은 의약품을 오늘 배송받기 · 최대 {formatFusdc(pharmacyBudget)}</p><p className="form-note">모델이 진단·처방하거나 약품·용량을 변경하지 않습니다. 실제 처방전·신분증·주소를 입력하거나 업로드하지 마세요.</p><dl className="purchase-details"><div><dt>구매 기한</dt><dd>오늘 배송 목표 · 실제 ISO 기한 미확정</dd></div><div><dt>예산 범위</dt><dd>상품·배송·사용자 부담 수수료 전체</dd></div><div><dt>추가 확인 필요</dt><dd>처방 조건, 배송 가능 여부, 수수료, 허용 판매처와 수신 주소</dd></div></dl></Card>
    <section aria-labelledby="pharmacy-quotes" className="pharmacy-section"><div className="section-heading"><h2 id="pharmacy-quotes">3 pharmacy options</h2><MockBadge /></div><div className="pharmacy-grid">{pharmacyQuotes.map(q => <Card key={q.id} className={selected === q.id ? "pharmacy-selected" : ""}><div className="section-heading"><h3>{q.merchant}</h3><span className="tag">{exceedsPreviewBudget(q) ? "BLOCKED · 데모 예산 초과" : "조건 확인 필요"}</span></div><dl className="purchase-details"><div><dt>의약품</dt><dd>{formatFusdc(q.medicationBaseUnits)}</dd></div><div><dt>배송</dt><dd>{formatFusdc(q.deliveryBaseUnits)}</dd></div><div><dt>상품·배송 소계</dt><dd>{formatFusdc(quoteSubtotal(q))}</dd></div><div><dt>조건</dt><dd>{q.requiresIdentity ? "처방전 + 신원 확인" : "처방전"}</dd></div></dl><p className="form-note">네트워크 수수료 미확정 · 실제 재고·배송·수신 주소 미검증</p><button className="button secondary" aria-pressed={selected === q.id} disabled={stopped} onClick={() => select(q.id)}>{q.merchant} 검토</button></Card>)}</div></section>
    <Card id="pharmacy-review"><div className="section-heading"><h2>Selected pharmacy / Mandate review</h2><span className="tag">{stopped ? "STOPPED · 로컬" : reviewed ? "데모 검토 확인됨" : "검토 대기"}</span></div>{quote ? <>
      <dl className="purchase-details"><div><dt>선택 후보</dt><dd>{quote.merchant} · {quote.id} (데모 ID)</dd></div><div><dt>예산 / 소계</dt><dd>{formatFusdc(pharmacyBudget)} / {formatFusdc(quoteSubtotal(quote))}</dd></div><div><dt>수수료 포함 최종 총액</dt><dd>미확정 · 실행 불가</dd></div><div><dt>AI 제안</dt><dd>연결 전 · 사용자 수동 선택이며 AI 추천 아님</dd></div><div><dt>정책 결과</dt><dd>{exceedsPreviewBudget(quote) ? "BLOCKED · 수수료를 더하기 전부터 예산 초과" : "미판정 · 소계만 예산 이내, 수수료·처방·기한·수신 주소 검증 필요"}</dd></div><div><dt>Mandate / Task Account</dt><dd>미생성 · 승인 버전·수신 주소·권한 증거 없음</dd></div></dl>
      <div className="api-actions"><button className="button secondary" disabled={reviewed || stopped || exceedsPreviewBudget(quote)} onClick={() => { if (reviewed || stopped || exceedsPreviewBudget(quote)) return; setReviewed(true); record(`${quote.merchant} 데모 검토 확인 · 위임 승인 아님`); }}>데모 검토 확인</button><button className="button primary" disabled>Mandate 확인 및 위임 승인 · 연결 전</button></div>
    </> : <p>약국 후보를 선택하면 조건과 미확정 항목을 확인할 수 있습니다.</p>}<p className="form-note">후보 변경 시 이전 검토 확인은 해제됩니다. 고정 수신자 Task Account에서는 판매처 변경 후 새로운 승인·권한이 필요합니다. 검토 버튼이나 로그인만으로 지출 권한이 생기지 않습니다.</p><button className="button danger" disabled={stopped} onClick={() => { if (stopped) return; setStopped(true); setReviewed(false); record("STOPPED · 사용자가 로컬 검토 중단 · 서버 작업 ID 없음 · 원격 취소/권한 폐기 아님"); }}>로컬 검토 중단(STOP)</button></Card>
    <Card className="pharmacy-section"><div className="section-heading"><h2>Authority, payment & fulfillment</h2><span className="tag">실행 연결 전</span></div><dl className="purchase-details"><div><dt>사용자 인증</dt><dd>{auth.session ? "Authenticated · 서버 검증된 로그인" : "미인증 · 지갑 연결과 별개"}</dd></div><div><dt>Mandate 승인</dt><dd>미승인 · 실제 승인 API 연결 전</dd></div><div><dt>지출 권한</dt><dd>비활성 · 사용자 서명/서버 권한 증거 없음</dd></div><div><dt>결제 상태</dt><dd>미실행 · 트랜잭션 없음</dd></div><div><dt>이행 상태</dt><dd>미검증 · 약국 주문/배송 증거 없음</dd></div><div><dt>완료 상태</dt><dd>미완료 · 결제 성공만으로 완료 처리하지 않음</dd></div></dl><p className="form-note">입금은 지출 승인이 아닙니다. Task Account 충전·실행 지갑의 가스·잔액 반환은 연결 전입니다. 결과 불명 거래는 서버 확인 전 자동 재시도하지 않습니다.</p><Link href="/login" className="text-link">지갑 로그인 확인 ↗</Link></Card>
    <Card className="pharmacy-section"><div className="section-heading"><h2>Review activity</h2><span className="tag">로컬 기록 · 새로고침 시 초기화</span></div>{events.length ? <ol className="purchase-events">{events.map((event, i) => <li key={i}><div><strong>{event.text}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString("ko-KR")}</time></div></li>)}</ol> : <p>아직 후보 검토 기록이 없습니다.</p>}<p className="form-note">이 기록은 실제 정책 엔진의 DENY/no-broadcast 증거가 아닙니다.</p></Card>
  </>;
}
