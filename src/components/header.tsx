"use client";
import styles from "./header.module.css";
import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletLoginButton } from "./wallet-login-button";
import { useLocale } from "@/lib/i18n";
export function Header() {
  const path = usePathname();
  const { locale, setLocale, t } = useLocale();
  return <header className={`site-header ${styles.header}`}><Link className="wordmark" href="/" aria-label={t("Floww 홈", "Floww home")}><BrandMark size={30} decorative />Floww</Link><nav aria-label={t("메인 메뉴", "Main menu")}><Link href="/" aria-current={path === "/" ? "page" : undefined}>{t("소개", "Overview")}</Link><Link href="/pharmacy" aria-current={path === "/pharmacy" ? "page" : undefined}>{t("구매 시나리오", "Purchase scenarios")}</Link><Link href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined}>{t("내 작업", "My Tasks")}</Link><Link href="/settings" aria-current={path === "/settings" ? "page" : undefined}>{t("설정", "Settings")}</Link></nav><div className={styles.actions}><div className={styles.localeSwitch} role="group" aria-label={t("표시 언어", "Display language")}><button type="button" aria-label={t("한국어로 변경", "Switch to Korean")} aria-pressed={locale === "ko"} onClick={() => setLocale("ko")}>KO</button><button type="button" aria-label={t("영어로 변경", "Switch to English")} aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button></div><WalletLoginButton className="button primary header-login" /></div></header>;
}
