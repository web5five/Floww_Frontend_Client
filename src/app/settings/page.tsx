"use client";

import Link from "next/link";
import { useLocale, type Locale } from "@/lib/i18n";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const { locale, setLocale, t } = useLocale();
  const options: { value: Locale; label: string }[] = [{ value: "ko", label: t("한국어", "Korean") }, { value: "en", label: t("영어", "English") }];
  return <main id="main" className={`page-shell ${styles.shell}`}>
    <span className="eyebrow">{t("환경 설정", "PREFERENCES")}</span>
    <h1>{t("설정", "Settings")}</h1>
    <p className={styles.intro}>{t("Floww에서 사용할 표시 언어를 선택하세요. 선택은 이 브라우저에 저장됩니다.", "Choose the language Floww displays. Your choice is saved in this browser.")}</p>
    <section className={styles.panel} aria-labelledby="language-heading">
      <h2 id="language-heading">{t("표시 언어", "Display language")}</h2>
      <p>{t("화면의 안내와 버튼 언어를 변경합니다. 기존 작업의 내용과 지갑 서명 메시지는 변경되지 않습니다.", "Changes the language of screen guidance and controls. Existing Task content and wallet signing messages stay unchanged.")}</p>
      <fieldset className={styles.options}><legend className={styles.srOnly}>{t("언어 선택", "Choose a language")}</legend>{options.map(option => <label key={option.value} className={styles.option}><input type="radio" name="language" value={option.value} checked={locale === option.value} onChange={() => setLocale(option.value)} /><span>{option.label}</span></label>)}</fieldset>
    </section>
    <Link className="text-link" href="/">{t("← 소개로 돌아가기", "← Back to Overview")}</Link>
  </main>;
}
