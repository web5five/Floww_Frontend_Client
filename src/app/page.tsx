import Link from "next/link";
import { ArrowDown, ArrowRight, Check, LockKeyhole, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import styles from "./overview.module.css";

const steps = [
  { title: "원하는 구매를 말하세요", body: "필요한 품목과 조건을 알려주면, 빠진 조건부터 함께 확인합니다." },
  { title: "권한의 범위를 정하세요", body: "구매 목적, 최대 총비용, 기한과 허용 판매처를 확인합니다." },
  { title: "제안을 보고 승인하세요", body: "Floww가 비교한 견적을 검토하고, 지갑에서 구매를 승인합니다." },
  { title: "결과를 확인하세요", body: "결제와 이행 결과를 한 작업에서 이어서 확인합니다." },
];
export default function Home() {
  return <main id="main" className="page-shell landing purchase-landing">
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><span className="tiny-star">✳</span> YOUR INTENT. YOUR APPROVAL.</div>
        <h1>Buy with<br />clarity.<br /><span>Stay in control.</span></h1>
        <p className="hero-description">구매는 Floww와 함께. 예산과 조건은 내가 정하고, 중요한 결정은 내 손으로.</p>
        <div className="hero-actions"><Link href="/pharmacy" className="button primary">로그인하고 시작 <ArrowRight size={19} /></Link><a className="text-link" href="#how-it-works">어떻게 작동하나요 <ArrowDown size={16} /></a></div>
        <div className="hero-note"><ShieldCheck size={16} /> 내가 승인한 범위 안에서만.</div>
      </div>
      <div className={styles.visual} aria-label="구매 목적부터 결과까지 이어지는 Floww의 과정">
        <div className={styles.visualTop}><span className={styles.brand}><BrandMark size={26} decorative />Floww</span><span className={styles.badge}><Sparkles size={14} /> Your purchase companion</span></div>
        <div className={styles.intent}><MessageCircle size={22} /><div><span>먼저, 나의 목적</span><strong>필요한 것을, 정해둔 조건 안에서.</strong></div></div>
        <div className={styles.bounds}><span>구매 목적</span><span>최대 총비용</span><span>기한</span><span>허용 판매처</span></div>
        <div className={styles.flow}><span>조건 확인</span><ArrowRight size={17} /><span>견적 비교</span><ArrowRight size={17} /><span>나의 승인</span></div>
        <div className={styles.control}><LockKeyhole size={22} /><p><strong>결정권은 언제나 나에게.</strong><span>조건을 벗어난 요청은 멈추고 알려드립니다.</span></p></div>
      </div>
    </section>
    <section id="how-it-works" className={styles.how}><div className="section-heading"><div><span className="eyebrow">HOW FLOWW WORKS</span><h2>한 번의 요청, 눈에 보이는 과정.</h2><p className={styles.sectionDescription}>무엇을 맡겼는지, 왜 선택했는지, 어디까지 진행됐는지.</p></div></div>
      <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
    </section>
    <section className={styles.boundary}><div><span className="eyebrow">A CLEAR BOUNDARY</span><h2>잘 사는 것만큼,<br />멈춰야 할 때도 명확하게.</h2><p>로그인 후 허용된 구매, 예산 초과, 허용되지 않은 판매처의 세 가지 시나리오를 선택할 수 있습니다. 같은 작업을 단계별 화면과 대화 화면에서 이어가세요.</p></div><ul><li><Check size={20} /> 내가 정한 조건으로 비교</li><li><Check size={20} /> 승인 전에는 구매하지 않기</li><li><Check size={20} /> 조건 밖의 요청은 차단</li></ul></section>
    <section className="bottom-cta"><div><span className="eyebrow">YOUR PURCHASE, YOUR CALL</span><h2>내 조건으로 시작해 보세요.</h2><p>지갑 로그인 후 세 가지 구매 흐름을 만나보세요.</p></div><Link href="/pharmacy" className="button primary">Floww 시작하기 <ArrowRight size={18} /></Link></section>
  </main>;
}
