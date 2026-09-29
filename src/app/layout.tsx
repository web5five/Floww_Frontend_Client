import type { Metadata } from "next";
import { DemoOrderProvider } from "@/components/demo-order-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Floww — Buy with clarity. Stay in control.", template: "%s | Floww" },
  description: "상품 조건과 예산을 확인하고 사용자가 최종 승인하는 Floww 구매 데모. 실제 결제 연결 전.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">본문으로 건너뛰기</a><WalletProvider><Header /><DemoOrderProvider>{children}</DemoOrderProvider></WalletProvider><footer className="site-footer"><span className="wordmark"><span className="logo-symbol" aria-hidden="true"><i /><i /><i /></span>Floww<span>®</span></span><p>Less noise. More clarity.</p><span>© {new Date().getFullYear()} Floww · Prototype</span></footer></body></html>;
}