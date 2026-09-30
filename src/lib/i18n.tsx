"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE } from "./locale-config";

export type Locale = "ko" | "en";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (ko: string, en: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale?: Locale; children: ReactNode }) {
  const router = useRouter();
  const [locale, updateLocale] = useState<Locale>(initialLocale ?? "ko");
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  function setLocale(next: Locale) {
    if (next !== "ko" && next !== "en") return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
    updateLocale(next);
    router.refresh();
  }
  return <LocaleContext.Provider value={{ locale, setLocale, t: (ko, en) => locale === "ko" ? ko : en }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale requires LocaleProvider");
  return value;
}

const walletNotices: Record<string, string> = {
  "이 앱의 지갑 연결을 해제했습니다. 지갑의 사이트 연결 권한은 지갑 설정에서 관리할 수 있습니다.": "Wallet disconnected from this app. Manage site permissions in your wallet settings.",
  "지갑 계정 또는 네트워크가 변경되었습니다. 다시 연결하고 로그인해야 합니다.": "Your wallet account or network changed. Reconnect and sign in again.",
  "지갑 연결이 끊겼습니다. 다시 연결해 주세요.": "Wallet connection lost. Please reconnect.",
  "지갑 연결됨 · 로그인 전. 연결만으로 사용자 인증이나 지출 권한이 생기지 않습니다.": "Wallet connected · not signed in. Connecting alone does not authenticate you or authorize spending.",
  "지갑 연결을 거절했습니다. 원할 때 다시 연결할 수 있습니다.": "Wallet connection rejected. You can connect again whenever you choose.",
  "지갑에 대기 중인 요청이 있습니다. 지갑 화면을 확인해 주세요.": "A request is pending in your wallet. Check your wallet screen.",
  "지갑 또는 네트워크 연결이 끊겼습니다.": "Wallet or network connection lost.",
  "지갑 연결을 확인하지 못했습니다. 지갑 상태를 확인하고 다시 시도해 주세요.": "Could not confirm the wallet connection. Check your wallet and try again.",
};

export function translateWalletNotice(value: string, locale: Locale): string {
  return locale === "ko" || !value ? value : walletNotices[value] ?? "Could not complete the wallet action. Check your wallet and try again.";
}

export function LocaleChrome({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  return <>
    <a className="skip-link" href="#main">{t("본문으로 건너뛰기", "Skip to content")}</a>
    {children}
    <footer className="site-footer"><span className="wordmark"><BrandMark size={30} decorative />Floww</span><p>{t("더 명확하게. 더 간결하게.", "Less noise. More clarity.")}</p><span>© {new Date().getFullYear()} Floww</span></footer>
  </>;
}
