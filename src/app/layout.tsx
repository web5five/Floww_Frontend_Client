import type { Metadata } from "next";
import { DemoOrderProvider } from "@/components/demo-order-provider";
import { WalletToolkitProvider } from "@/components/wallet-toolkit-provider";
import { Header } from "@/components/header";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Floww — Buy with clarity. Stay in control.", template: "%s | Floww" },
  description: "상품 조건과 예산을 확인하고, 지갑으로 승인과 구매 진행을 관리하는 Floww.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">본문으로 건너뛰기</a><WalletToolkitProvider><Header /><DemoOrderProvider>{children}</DemoOrderProvider></WalletToolkitProvider><footer className="site-footer"><span className="wordmark"><span className="logo-symbol" aria-hidden="true"><i /><i /><i /></span>Floww<span>®</span></span><p>Less noise. More clarity.</p><span>© {new Date().getFullYear()} Floww</span></footer></body></html>;
}
