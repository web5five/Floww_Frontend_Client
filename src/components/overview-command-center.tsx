"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Headphones,
  LockKeyhole,
  Monitor,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import styles from "./overview-command-center.module.css";

type ScenarioId = "allowed" | "budget" | "recipient";

const scenarios = {
  allowed: {
    eyebrow: ["허용된 구매", "Permitted purchase"],
    title: ["약국을 비교하고 선택한 구매를 승인", "Compare pharmacies and approve the selected purchase"],
    summary: ["Kiln이 약국 후보를 제안하고 서버 정책이 검증한 뒤 사용자가 지갑에서 최종 승인합니다.", "Kiln proposes a pharmacy candidate, server policy verifies it, and the user gives final wallet approval."],
    pharmacy: "Pharmacy A",
    amount: "23.50 fUSDC",
    decision: "ALLOW",
    reason: ["금액과 수취인이 위임 범위 안에 있습니다.", "Amount and recipient are within the mandate."],
    proof: ["승인 → Sepolia 지급 → 이행 확인", "Approval → Sepolia payment → fulfillment"],
    tone: "allow",
  },
  budget: {
    eyebrow: ["예산 초과", "Over budget"],
    title: ["약국 B 견적이 60 fUSDC 한도를 초과", "Pharmacy B quote exceeds the 60 fUSDC limit"],
    summary: ["정책이 서명과 브로드캐스트 전에 요청을 멈춥니다.", "Policy stops the request before signing or broadcast."],
    pharmacy: "Pharmacy B",
    amount: "64.00 fUSDC",
    decision: "DENY",
    reason: ["AMOUNT_EXCEEDS_MANDATE", "AMOUNT_EXCEEDS_MANDATE"],
    proof: ["서명 없음 · 전송 없음 · TX 없음", "No signature · no broadcast · no TX"],
    tone: "deny",
  },
  recipient: {
    eyebrow: ["수취인 조건", "Recipient condition"],
    title: ["약국 C 수취인이 허용되는지 확인", "Check whether Pharmacy C's recipient is permitted"],
    summary: ["서버의 판매자 주소와 다르면 거래를 만들지 않습니다.", "No transaction is created when the recipient differs from the server merchant registry."],
    pharmacy: "Pharmacy C",
    amount: "19.00 fUSDC",
    decision: "DENY",
    reason: ["RECIPIENT_NOT_ALLOWED", "RECIPIENT_NOT_ALLOWED"],
    proof: ["서명 없음 · 전송 없음 · TX 없음", "No signature · no broadcast · no TX"],
    tone: "deny",
  },
} as const;

const scenarioOrder: ScenarioId[] = ["allowed", "budget", "recipient"];

export function OverviewCommandCenter() {
  const [selected, setSelected] = useState<ScenarioId>("allowed");
  const [pane, setPane] = useState<"cases" | "evidence">("cases");
  const { t } = useLocale();
  const translate = (value: readonly [string, string]) => t(value[0], value[1]);
  const scenario = scenarios[selected];
  const steps = [
    [t("원하는 구매를 말하세요", "Describe the purchase"), t("품목, 예산과 기한을 하나의 Task로 저장합니다.", "Save the item, budget, and deadline in one Task.")],
    [t("약국 세 곳을 비교하세요", "Compare three pharmacies"), t("Kiln은 견적을 검토하고 적합한 후보만 제안합니다.", "Kiln reviews the quotes and proposes a suitable candidate.")],
    [t("범위 안에서만 승인하세요", "Approve only within bounds"), t("서버 정책과 지갑 승인을 분리해 실행 직전 다시 확인합니다.", "Server policy and wallet approval remain separate and are checked again before execution.")],
    [t("결제와 이행을 확인하세요", "Verify payment and fulfillment"), t("Sepolia 거래와 약국 이행 결과가 확인된 뒤 Task가 완료됩니다.", "The Task completes after the Sepolia transaction and pharmacy fulfillment are verified.")],
  ];

  return (
    <main id="main" className={`page-shell ${styles.shell}`}>
      <section className={styles.app} aria-label={t("Floww 심사 데모 콘솔", "Floww judge demo console")}>
        <header className={styles.appHeader}>
          <div>
            <span className={styles.liveDot} aria-hidden="true" />
            <strong>{t("Floww 구매 스튜디오", "Floww Purchase Studio")}</strong>
            <span className={styles.network}>Sepolia · fUSDC</span>
          </div>
          <div className={styles.headerStatus}><ShieldCheck size={16} /> {t("승인 전에는 결제되지 않아요", "Nothing is paid before approval")}</div>
        </header>

        <div className={styles.appBody}>
          <aside className={styles.rail} aria-label={t("기능 바로가기", "Feature shortcuts")}>
            <div className={styles.railPrimary}>
              <span className={styles.railLabel}>FLOWW</span>
              <button className={styles.railActive} type="button" aria-label={t("구매 데모", "Purchase demo")}>
                <ShoppingBag size={20} /><span>{t("구매", "Buy")}</span>
              </button>
              <Link href="/voice" aria-label={t("음성 도우미", "Voice assistant")}><Headphones size={20} /><span>{t("음성", "Voice")}</span></Link>
              <Link href="/dashboard" aria-label={t("내 작업", "My Tasks")}><FileCheck2 size={20} /><span>{t("작업", "Tasks")}</span></Link>
            </div>
            <Link className={styles.railWallet} href="/login?returnTo=%2Fpharmacy" aria-label={t("지갑 로그인", "Wallet sign-in")}>
              <Wallet size={20} /><span>{t("로그인", "Sign in")}</span>
            </Link>
          </aside>

          <nav className={styles.paneTabs} aria-label={t("데모 화면", "Demo view")}>
            <button type="button" aria-pressed={pane === "cases"} onClick={() => setPane("cases")}>{t("사례 선택", "Choose case")}</button>
            <button type="button" aria-pressed={pane === "evidence"} onClick={() => setPane("evidence")}>{t("판단 · 증거", "Decision · evidence")}</button>
          </nav>

          <section className={styles.workspace} data-active={pane === "cases"}>
            <div className={styles.titleRow}>
              <div>
                <span className={styles.kicker}><Sparkles size={15} /> {t("내 목적. 내 승인.", "YOUR INTENT. YOUR APPROVAL.")}</span>
                <h1><span className={styles.titleLead}>{t("명확하게 구매하고", "Buy with clarity")}</span><br /><span className={styles.titleAccent}>{t("내가 결정합니다.", "Stay in control.")}</span></h1>
              </div>
              <div className={styles.taskChip}><span>{t("작업 한도", "Task limit")}</span><strong>60.00 fUSDC</strong></div>
            </div>

            <div className={styles.requestCard}>
              <div className={styles.requestIcon}><ShoppingBag size={21} /></div>
              <div><span>{t("공통 구매 요청", "Shared purchase request")}</span><strong>{t("이전에 처방받은 의약품 1개 구매", "Buy one pack of previously prescribed medicine")}</strong></div>
              <div className={styles.requestMeta}><Clock3 size={16} /><span>{t("24시간 이내", "Within 24 hours")}</span></div>
            </div>

            <div className={styles.sectionTitle}>
              <div><span>{t("직접 확인할 세 가지 흐름", "THREE INTERACTIVE PATHS")}</span><strong>{t("구매 또는 차단 사례를 선택하세요", "Choose a purchase or blocked case")}</strong></div>
              <span>1 SUCCESS · 2 DENY</span>
            </div>

            <div className={styles.scenarios} role="group" aria-label={t("필수 데모 선택", "Required demo selection")}>
              {scenarioOrder.map((id, index) => {
                const item = scenarios[id];
                const active = selected === id;
                return <button key={id} type="button" className={active ? styles.scenarioActive : styles.scenario} aria-pressed={active} onClick={() => { setSelected(id); setPane("evidence"); }}>
                  <span className={styles.scenarioNumber}>0{index + 1}</span>
                  <span className={styles.scenarioText}><strong>{translate(item.eyebrow)}</strong><small>{item.amount}</small></span>
                  {id === "allowed" ? <Check size={17} /> : <X size={17} />}
                </button>;
              })}
            </div>

            <div className={styles.workspaceFooter}>
              <div><LockKeyhole size={17} /><span>{t("로그인은 신원 확인이며 구매 승인은 별도입니다.", "Sign-in verifies identity; purchase approval is separate.")}</span></div>
              <Link className="button primary" href="/login?returnTo=%2Fpharmacy">{t("로그인하고 시작", "Sign in to start")} <ArrowRight size={17} /></Link>
            </div>
          </section>

          <aside className={styles.insight} data-active={pane === "evidence"} aria-live="polite">
            <div className={styles.insightTop}>
              <div className={styles.botIcon}><Bot size={22} /></div>
              <div><span>Kiln · qwen3-32b</span><strong>{t("판단 및 실행 증거", "Decision and execution evidence")}</strong></div>
              <span className={styles.ready}>READY</span>
            </div>

            <div className={styles.recommendation}>
              <span>{translate(scenario.eyebrow)}</span>
              <h2>{translate(scenario.title)}</h2>
              <p>{translate(scenario.summary)}</p>
            </div>

            <div className={styles.quote}>
              <div><Store size={18} /><span>{t("선택 약국", "Selected pharmacy")}</span><strong>{scenario.pharmacy}</strong></div>
              <div><CircleDollarSign size={18} /><span>{t("결제 금액", "Payment amount")}</span><strong>{scenario.amount}</strong></div>
            </div>

            <div className={`${styles.decision} ${scenario.tone === "allow" ? styles.decisionAllow : styles.decisionDeny}`}>
              <div>{scenario.tone === "allow" ? <PackageCheck size={22} /> : <ShieldCheck size={22} />}<span>{t("정책 결과", "Policy result")}</span><strong>{scenario.decision}</strong></div>
              <p>{translate(scenario.reason)}</p>
            </div>

            <ol className={styles.flow} aria-label={t("구매 처리 단계", "Purchase processing steps")}>
              <li className={styles.flowDone}><span><Check size={13} /></span><div><strong>{t("지갑 인증 · Task · 견적 3개", "Wallet auth · Task · three quotes")}</strong><small>{t("같은 Task에서 전체 과정 유지", "One Task across the complete journey")}</small></div></li>
              <li className={styles.flowDone}><span><Check size={13} /></span><div><strong>{t("AI 제안 · 서버 정책", "AI proposal · server policy")}</strong><small>{t("AI는 제안하고 정책이 결정", "AI proposes; deterministic policy decides")}</small></div></li>
              <li className={scenario.tone === "allow" ? styles.flowCurrent : styles.flowLocked}><span>{scenario.tone === "allow" ? "3" : <LockKeyhole size={12} />}</span><div><strong>{scenario.tone === "allow" ? t("사용자 승인과 실행", "User approval and execution") : t("실행 전 차단", "Blocked before execution")}</strong><small>{translate(scenario.proof)}</small></div></li>
            </ol>

            <Link className={styles.detailLink} href="/login?returnTo=%2Fpharmacy">{t("로그인하여 실제 기록 열기", "Sign in to open live records")} <ChevronRight size={17} /></Link>
          </aside>
        </div>
      </section>
      <section className={styles.overviewDetails} aria-labelledby="floww-process-title">
        <div className={styles.detailsHeading}>
          <span>{t("Floww 이용 방법", "HOW FLOWW WORKS")}</span>
          <h2 id="floww-process-title">{t("한 번의 요청, 눈에 보이는 과정.", "One request. A clear path forward.")}</h2>
          <p>{t("심사위원은 정상 실행 한 번과 거래 전 차단 두 번을 같은 사용자 흐름에서 확인할 수 있습니다.", "Judges can inspect one successful execution and two pre-broadcast blocks in the same user journey.")}</p>
        </div>
        <ol className={styles.processGrid}>{steps.map(([title, body], index) => <li key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></li>)}</ol>
        <div className={styles.boundaryStrip}>
          <div><LockKeyhole size={24} /><span>{t("로그인", "Sign-in")}</span><strong>{t("지갑 신원 확인", "Wallet identity")}</strong></div>
          <ArrowRight size={18} aria-hidden="true" />
          <div><Bot size={24} /><span>{t("제안과 정책", "Proposal and policy")}</span><strong>{t("AI 제안 · 결정론적 검증", "AI proposal · deterministic checks")}</strong></div>
          <ArrowRight size={18} aria-hidden="true" />
          <div><Wallet size={24} /><span>{t("별도 승인", "Separate approval")}</span><strong>{t("EIP-712 · Task Account", "EIP-712 · Task Account")}</strong></div>
          <ArrowRight size={18} aria-hidden="true" />
          <div><PackageCheck size={24} /><span>{t("완료 조건", "Completion")}</span><strong>{t("결제와 이행 확인", "Payment and fulfillment")}</strong></div>
        </div>
        <div className={styles.experienceGrid}>
          <article className={styles.deviceCard}>
            <div className={styles.deviceCopy}><span><Monitor size={18} /> {t("웹 구매 여정", "WEB PURCHASE JOURNEY")}</span><h3>{t("요청부터 승인까지 한 작업으로", "One Task from request to approval")}</h3><p>{t("조건, 약국 3곳, AI 제안과 지갑 승인을 단계별 화면에서 이어서 확인합니다.", "Review conditions, three pharmacies, the AI proposal, and wallet approval across connected steps.")}</p></div>
            <div className={styles.browserMock} aria-hidden="true"><div><i /><i /><i /></div><ol><li className={styles.mockDone}>01 <b>{t("요청", "Request")}</b></li><li className={styles.mockDone}>02 <b>{t("판단", "Decision")}</b></li><li className={styles.mockCurrent}>03 <b>{t("승인", "Approval")}</b></li><li>04 <b>{t("결과", "Result")}</b></li></ol><section><span>Task</span><strong>23.50 fUSDC</strong><em>ALLOW</em></section></div>
          </article>
          <article className={styles.deviceCard}>
            <div className={styles.deviceCopy}><span><Smartphone size={18} /> {t("모바일 결과 화면", "MOBILE RESULT VIEW")}</span><h3>{t("성공과 차단 증거를 즉시 구분", "See success and blocked evidence instantly")}</h3><p>{t("정상 실행은 TX와 이행 상태를, 차단 사례는 DENY 사유와 거래 없음 상태를 보여줍니다.", "Success shows the TX and fulfillment state; blocked cases show the DENY reason and no-transaction state.")}</p></div>
            <div className={styles.phoneMock} aria-hidden="true"><div className={styles.phoneTop}><span>Floww</span><i /></div><div className={styles.phoneResult}><span>{t("정책 결과", "Policy result")}</span><strong>DENY</strong><small>RECIPIENT_NOT_ALLOWED</small></div><ul><li><Check size={13} /> {t("사유 기록", "Reason logged")}</li><li><Check size={13} /> {t("브로드캐스트 없음", "No broadcast")}</li><li><Check size={13} /> {t("TX 해시 없음", "No TX hash")}</li></ul></div>
          </article>
        </div>
      </section>
    </main>
  );
}
