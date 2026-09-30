import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DemoOrderProvider } from "@/components/demo-order-provider";
import { WalletToolkitProvider } from "@/components/wallet-toolkit-provider";
import { Header } from "@/components/header";
import { LocaleChrome, LocaleProvider, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/locale-config";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

async function requestLocale(): Promise<Locale> {
  return (await cookies()).get(LOCALE_COOKIE)?.value === "en" ? "en" : "ko";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return {
    title: { default: locale === "ko" ? "Floww — 내 조건으로, 명확하게" : "Floww — Buy with clarity. Stay in control.", template: "%s | Floww" },
    description: locale === "ko" ? "상품 조건과 예산을 확인하고, 지갑으로 승인과 구매 진행을 관리하는 Floww." : "Review purchase conditions and budgets, then manage approval and progress with your wallet in Floww.",
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await requestLocale();
  return <html lang={locale} data-scroll-behavior="smooth"><body><LocaleProvider initialLocale={locale}><WalletToolkitProvider><LocaleChrome><Header /><DemoOrderProvider>{children}</DemoOrderProvider></LocaleChrome></WalletToolkitProvider></LocaleProvider></body></html>;
}
