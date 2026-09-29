import Link from "next/link";
import { ArrowDown, ArrowUpRight, ClipboardList, ScanSearch, ShieldCheck, Sparkles, ShoppingBag, Receipt, UserCheck } from "lucide-react";
import { Card, GetStarted, MockBadge } from "@/components/ui";
const steps = [
  { number: "01 / DEFINE", title: "구매 조건 설정", description: "처방된 품목, 예산과 기한을 확인하세요. 지갑 로그인과 위임 승인은 별개입니다.", target: "pharmacy-request", Icon: ClipboardList },
  { number: "02 / UNDERSTAND", title: "AI 상품 조건 분석", description: "약국 후보를 비교하고 qwen3-32b의 제안을 검토합니다. 모델 제안은 지출 권한이 아닙니다.", target: "server-task", Icon: ScanSearch },
  { number: "03 / CHECK", title: "정책 및 예산 검사", description: "누적 한도와 승인된 수신자를 검사합니다. DENY 시 서명·거래 전송을 진행하지 않습니다.", target: "pharmacy-policy", Icon: ShieldCheck },
  { number: "04 / APPROVE", title: "사용자 최종 승인", description: "선택 견적과 위임 버전을 확인합니다. 실제 EIP-712 승인은 체인 계약 정렬 대기 중입니다.", target: "pharmacy-review", Icon: UserCheck },
  { number: "05 / VERIFY", title: "테스트넷 결제 및 증거 확인", description: "거래 영수증과 이행 검증을 각각 확인합니다. 실제 결제·완료 증거는 아직 연결 전입니다.", target: "pharmacy-evidence", Icon: Receipt },
];
export default function Home() {
  return <main id="main" className="page-shell landing purchase-landing">
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><span className="tiny-star">✳</span> YOUR INTENT. YOUR APPROVAL.</div><h1>Buy with<br />clarity.<br /><span>Stay in control.</span></h1><p className="hero-description">Floww는 사용자가 정한 상품 조건, 예산과 기한 안에서 AI가 구매 후보를 검토하고, 최종 승인 전까지 지출을 실행하지 않습니다.</p><div className="hero-actions"><GetStarted /><a className="text-link" href="#how-it-works">작동 방식 보기 <ArrowDown size={16} /></a></div><div className="hero-note"><ShieldCheck size={16} /> 현재는 로컬 데모 · 실제 구매·결제 연결 전</div></div>
      <div className="hero-visual" aria-label="Floww 구매 승인 데모 미리보기">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="visual-star">✳</div>
        <div className="floating-chip"><Sparkles size={17} /> A clear intent. A considered purchase.</div>
        <Card className="preview-card"><div className="preview-top"><span className="mini-brand">floww</span><MockBadge /></div><p className="label">Your purchase limit</p><div className="preview-balance">60 <span>fUSDC</span></div><span className="positive performance"><ShieldCheck size={14} /> 승인 전 지출 없음</span><div className="preview-product"><span className="icon-tile"><ShoppingBag size={27} /></span><div><strong>약국 구매 비교</strong><p>처방된 품목 · 약국 3곳</p></div></div><dl className="preview-prices"><div><dt>데모 후보 소계</dt><dd>23.5 / 64 / 19 fUSDC</dd></div><div><dt>수수료 포함 최종 총액</dt><dd>서버 견적 확인 필요</dd></div><div><dt>구매 기한</dt><dd>직접 설정</dd></div></dl><div className="preview-insight"><span className="icon-tile yellow"><UserCheck size={19} /></span><div><strong>Your approval comes first.</strong><p>예시 제안 · 사용자 최종 승인 필요</p></div></div></Card>
        <div className="control-chip"><span className="control-icon"><ShieldCheck size={22} /></span><div><strong>You’re in control.</strong><span>테스트넷 연결 전 · 결제 미실행</span></div></div>
      </div>
    </section>
    <section id="how-it-works" className="intro-grid">
      <Card className="intro-card"><div className="eyebrow"><span className="tiny-star">✳</span> MEET FLOWW</div><h2>Intent to purchase.<br /><span>You decide.</span></h2><p>조건 설정부터 최종 승인까지.<br />AI는 검토를 돕고, 결정은 사용자가 합니다.</p><Link href="/pharmacy" className="circle-link" aria-label="구매 대시보드 살펴보기"><ArrowUpRight size={25} /></Link></Card>
      {steps.map(({ number, title, description, target, Icon }, index) => <Card key={number} className="feature-card"><span className={`icon-tile ${index % 2 ? "yellow" : ""}`}><Icon /></span><span className="step-number">{number}</span><h3>{title}</h3><p>{description}</p><Link href={`/pharmacy#${target}`} className="feature-bottom" aria-label={`${title} 보기`}><span>{index === 4 ? "연결 전 상태 확인" : "데모에서 살펴보기"}</span><ArrowUpRight size={19} /></Link></Card>)}
    </section>
    <section className="bottom-cta"><div><span className="eyebrow">CHALLENGE B · BUY WITH CLARITY</span><h2>A smarter purchase starts with you.</h2><p>약국 3곳, 최대 60 fUSDC. 후보 비교부터 정책 차단과 증거 확인까지 살펴보세요.</p></div><GetStarted>구매 데모 살펴보기</GetStarted></section>
  </main>;
}
