"use client";
import { Suspense } from "react";
import { WalletLogin } from "@/components/wallet-login";
import { useLocale } from "@/lib/i18n";
export default function LoginPage() { const { t } = useLocale(); return <Suspense fallback={<main id="main" className="page-shell"><p role="status">{t("로그인 화면을 준비하고 있습니다.", "Preparing the sign-in screen.")}</p></main>}><WalletLogin /></Suspense>; }
