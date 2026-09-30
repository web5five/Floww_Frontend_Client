"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight, Check, LockKeyhole, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import styles from "./overview.module.css";
import { useLocale } from "@/lib/i18n";

export default function Home() {
  const { locale, t } = useLocale();
  const steps = [
    { title: t("원하는 구매를 말하세요", "Describe what you want to buy"), body: t("필요한 품목과 조건을 알려주면, 빠진 조건부터 함께 확인합니다.", "Tell us what you need and your conditions. We will clarify any missing details first.") },
    { title: t("권한의 범위를 정하세요", "Set your boundaries"), body: t("구매 목적, 최대 총비용, 기한과 허용 판매처를 확인합니다.", "Review the purchase purpose, total spending limit, deadline, and allowed merchants.") },
    { title: t("제안을 보고 승인하세요", "Review and approve the proposal"), body: t("Floww가 비교한 견적을 검토하고, 지갑에서 구매를 승인합니다.", "Review the quotes Floww compares, then approve the purchase in your wallet.") },
    { title: t("결과를 확인하세요", "Follow the result"), body: t("결제와 이행 결과를 한 작업에서 이어서 확인합니다.", "Follow payment and fulfillment results in the same Task.") },
  ];
  return <main id="main" className="page-shell landing purchase-landing">
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><span className="tiny-star">✳</span> {t("내 목적. 내 승인.", "YOUR INTENT. YOUR APPROVAL.")}</div>
        <h1 className={styles.heroTitle}>{locale === "ko" ? <>명확하게<br />구매하고.<br /><span>내가 결정합니다.</span></> : <>Buy with<br />clarity.<br /><span>Stay in control.</span></>}</h1>
        <p className="hero-description">{t("구매는 Floww와 함께. 예산과 조건은 내가 정하고, 중요한 결정은 내 손으로.", "Buy with Floww. Set your budget and conditions, and make every important decision yourself.")}</p>
        <div className="hero-actions"><Link href="/pharmacy" className="button primary">{t("로그인하고 시작", "Sign in to start")} <ArrowRight size={19} /></Link><a className="text-link" href="#how-it-works">{t("어떻게 작동하나요", "How it works")} <ArrowDown size={16} /></a></div>
        <div className="hero-note"><ShieldCheck size={16} /> {t("내가 승인한 범위 안에서만.", "Only within the boundaries you approve.")}</div>
      </div>
      <div className={styles.visual} aria-label={t("구매 목적부터 결과까지 이어지는 Floww의 과정", "Floww process from purchase intent to result")}>
        <div className={styles.visualTop}><span className={styles.brand}><BrandMark size={26} decorative />Floww</span><span className={styles.badge}><Sparkles size={14} /> {t("나의 구매 도우미", "Your purchase companion")}</span></div>
        <div className={styles.intent}><MessageCircle size={22} /><div><span>{t("먼저, 나의 목적", "First, your intent")}</span><strong>{t("필요한 것을, 정해둔 조건 안에서.", "What you need, within your boundaries.")}</strong></div></div>
        <div className={styles.bounds}><span>{t("구매 목적", "Purchase purpose")}</span><span>{t("최대 총비용", "Total limit")}</span><span>{t("기한", "Deadline")}</span><span>{t("허용 판매처", "Allowed merchants")}</span></div>
        <div className={styles.flow}><span>{t("조건 확인", "Review conditions")}</span><ArrowRight size={17} /><span>{t("견적 비교", "Compare quotes")}</span><ArrowRight size={17} /><span>{t("나의 승인", "Your approval")}</span></div>
        <div className={styles.control}><LockKeyhole size={22} /><p><strong>{t("결정권은 언제나 나에게.", "The decision stays with you.")}</strong><span>{t("조건을 벗어난 요청은 멈추고 알려드립니다.", "Requests outside your boundaries stop for your review.")}</span></p></div>
      </div>
    </section>
    <section id="how-it-works" className={styles.how}><div className="section-heading"><div><span className="eyebrow">{t("Floww 이용 방법", "HOW FLOWW WORKS")}</span><h2>{t("한 번의 요청, 눈에 보이는 과정.", "One request. A clear path forward.")}</h2><p className={styles.sectionDescription}>{t("무엇을 맡겼는지, 왜 선택했는지, 어디까지 진행됐는지.", "See what you requested, why an option was selected, and how far it has progressed.")}</p></div></div>
      <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
    </section>
    <section className={styles.boundary}><div><span className="eyebrow">{t("명확한 경계", "A CLEAR BOUNDARY")}</span><h2>{locale === "ko" ? <>잘 사는 것만큼,<br />멈춰야 할 때도 명확하게.</> : <>Know when to buy,<br />and when to stop.</>}</h2><p>{t("로그인 후 허용된 구매, 예산 초과, 허용되지 않은 판매처의 세 가지 시나리오를 선택할 수 있습니다. 같은 작업을 단계별 화면과 대화 화면에서 이어가세요.", "After sign in, explore three purchase paths: an allowed purchase, one over budget, and one with a merchant outside your list. Continue the same Task in the step view or chat.")}</p></div><ul><li><Check size={20} /> {t("내가 정한 조건으로 비교", "Compare within your conditions")}</li><li><Check size={20} /> {t("승인 전에는 구매하지 않기", "No purchase before your approval")}</li><li><Check size={20} /> {t("조건 밖의 요청은 차단", "Block requests outside your conditions")}</li></ul></section>
    <section className="bottom-cta"><div><span className="eyebrow">{t("내 구매, 내 결정", "YOUR PURCHASE, YOUR CALL")}</span><h2>{t("내 조건으로 시작해 보세요.", "Start on your terms.")}</h2><p>{t("지갑 로그인 후 세 가지 구매 흐름을 만나보세요.", "Sign in with your wallet to explore three purchase paths.")}</p></div><Link href="/pharmacy" className="button primary">{t("Floww 시작하기", "Get started with Floww")} <ArrowRight size={18} /></Link></section>
  </main>;
}
