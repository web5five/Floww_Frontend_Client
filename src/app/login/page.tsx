import type { Metadata } from "next";
import { Suspense } from "react";
import { WalletLogin } from "@/components/wallet-login";
export const metadata: Metadata = { title: "지갑 로그인" };
export default function LoginPage() { return <Suspense fallback={<main id="main" className="page-shell"><p role="status">로그인 화면을 준비하고 있습니다.</p></main>}><WalletLogin /></Suspense>; }
