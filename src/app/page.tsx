import Link from "next/link";
import { ArrowDown, ArrowUpRight, ClipboardList, ScanSearch, ShieldCheck, Sparkles, ShoppingBag, Receipt, UserCheck } from "lucide-react";
import { Card, GetStarted, MockBadge } from "@/components/ui";
const steps = [
  { number: "01 / DEFINE", title: "구매 조건 설정", description: "상품, 예산, 기한과 허용 판매처를 정하세요.", target: "mandate-form", Icon: ClipboardList },
  { number: "02 / UNDERSTAND", title: "AI 상품 조건 분석", description: "후보가 원하는 조건에 맞는지 확인합니다. qwen3-32b 연결 전 · 데모 판단.", target: "ai-insight", Icon: ScanSearch },
  { number: "03 / CHECK", title: "정책 및 예산 검사", description: "수수료 포함 총액과 허용 판매처를 확인하고, 조건을 벗어나면 차단합니다.", target: "purchase-budget", Icon: ShieldCheck },
  { number: "04 / APPROVE", title: "사용자 최종 승인", description: "최종 결정은 당신에게. 승인 전까지 지출을 실행하지 않습니다.", target: "purchase-approval", Icon: UserCheck },
  { number: "05 / VERIFY", title: "테스트넷 결제 및 증거 확인", description: "향후 연결할 단계입니다. 현재는 테스트넷 연결 전이며 결제·구매 증거가 없습니다.", target: "purchase-evidence", Icon: Receipt },
];
export default function Home() {
  return <main id="main" className="page-shell landing purchase-landing">
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><span className="tiny-star">✳</span> YOUR INTENT. YOUR APPROVAL.</div><h1>Buy with<br />clarity.<br /><span>Stay in control.</span></h1><p className="hero-description">Floww는 사용자가 정한 상품 조건, 예산과 기한 안에서 AI가 구매 후보를 검토하고, 최종 승인 전까지 지출을 실행하지 않습니다.</p><div className="hero-actions"><GetStarted /><a className="text-link" href="#how-it-works">작동 방식 보기 <ArrowDown size={16} /></a></div><div className="hero-note"><ShieldCheck size={16} /> 현재는 로컬 데모 · 실제 구매·결제 연결 전</div></div>
      <div className="hero-visual" aria-label="Floww 구매 승인 데모 미리보기">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="visual-star">✳</div>
        <div className="floating-chip"><Sparkles size={17} /> A clear intent. A considered purchase.</div>
        <Card className="preview-card"><div className="preview-top"><span className="mini-brand">floww</span><MockBadge /></div><p className="label">Your purchase limit</p><div className="preview-balance">120 <span>USDC</span></div><span className="positive performance"><ShieldCheck size={14} /> 승인 전 지출 없음</span><div className="preview-product"><span className="icon-tile"><ShoppingBag size={27} /></span><div><strong>Nike 러닝화</strong><p>검정 · EU 45</p></div></div><dl className="preview-prices"><div><dt>상품 가격 + 예상 수수료</dt><dd>105 + 3 USDC</dd></div><div><dt>제안 후 남은 예산</dt><dd>12 USDC</dd></div><div><dt>구매 기한</dt><dd>직접 설정</dd></div></dl><div className="preview-insight"><span className="icon-tile yellow"><UserCheck size={19} /></span><div><strong>Your approval comes first.</strong><p>예시 제안 · 사용자 최종 승인 필요</p></div></div></Card>
        <div className="control-chip"><span className="control-icon"><ShieldCheck size={22} /></span><div><strong>You’re in control.</strong><span>테스트넷 연결 전 · 결제 미실행</span></div></div>
      </div>
    </section>
    <section id="how-it-works" className="intro-grid">
      <Card className="intro-card"><div className="eyebrow"><span className="tiny-star">✳</span> MEET FLOWW</div><h2>Intent to purchase.<br /><span>You decide.</span></h2><p>조건 설정부터 최종 승인까지.<br />AI는 검토를 돕고, 결정은 사용자가 합니다.</p><Link href="/dashboard" className="circle-link" aria-label="구매 대시보드 살펴보기"><ArrowUpRight size={25} /></Link></Card>
      {steps.map(({ number, title, description, target, Icon }, index) => <Card key={number} className="feature-card"><span className={`icon-tile ${index % 2 ? "yellow" : ""}`}><Icon /></span><span className="step-number">{number}</span><h3>{title}</h3><p>{description}</p><Link href={`/dashboard#${target}`} className="feature-bottom" aria-label={`${title} 보기`}><span>{index === 4 ? "연결 전 상태 확인" : "데모에서 살펴보기"}</span><ArrowUpRight size={19} /></Link></Card>)}
    </section>
    <section className="bottom-cta"><div><span className="eyebrow">CHALLENGE B · BUY WITH CLARITY</span><h2>A smarter purchase starts with you.</h2><p>Nike 검정 러닝화, EU 45, 최대 120 USDC. 첫 구매 승인 흐름을 체험하세요.</p></div><GetStarted>구매 데모 살펴보기</GetStarted></section>
  </main>;
}
