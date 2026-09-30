"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export type Locale = "ko" | "en";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (ko: string, en: string) => string;
};

export const LOCALE_COOKIE = "floww-locale";
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale?: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(initialLocale ?? "ko");
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  function setLocale(next: Locale) {
    if (next !== "ko" && next !== "en") return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
    updateLocale(next);
  }
  return <LocaleContext.Provider value={{ locale, setLocale, t: (ko, en) => locale === "ko" ? ko : en }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale requires LocaleProvider");
  return value;
}

export function LocaleChrome({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  return <>
    <a className="skip-link" href="#main">{t("본문으로 건너뛰기", "Skip to content")}</a>
    {children}
    <footer className="site-footer"><span className="wordmark"><BrandMark size={30} decorative />Floww</span><p>{t("더 명확하게. 더 간결하게.", "Less noise. More clarity.")}</p><span>© {new Date().getFullYear()} Floww</span></footer>
  </>;
}
