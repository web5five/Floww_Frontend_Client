"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "./wallet-provider";
import { loginReturnTo } from "@/lib/auth/return-to";
import { useLocale } from "@/lib/i18n";

function CheckingSession() {
  const { t } = useLocale();
  return <main id="main" className="page-shell"><p role="status" aria-live="polite">{t("로그인을 확인하고 있습니다.", "Checking your sign-in.")}</p></main>;
}

function SessionBoundary({ children }: { children: ReactNode }) {
  const { auth } = useWallet();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const returnTo = loginReturnTo(`${pathname}${query ? `?${query}` : ""}`);
  const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  const authenticated = !!auth.session;
  useEffect(() => {
    if (auth.initialized && !authenticated) router.replace(loginUrl);
  }, [auth.initialized, authenticated, loginUrl, router]);
  if (!auth.initialized) return <CheckingSession />;
  if (!authenticated) return <main id="main" className="page-shell"><h1>{t("로그인 후 이어가세요.", "Sign in to continue.")}</h1><p>{t("시나리오와 대화는 내 지갑으로 로그인한 뒤 시작할 수 있습니다.", "Sign in with your wallet to start scenarios and chat.")}</p><Link className="button primary" href={loginUrl}>{t("지갑으로 로그인", "Sign in with wallet")}</Link></main>;
  // This controls presentation only. Every Task/voice BFF still authenticates on the server.
  return children;
}

export function ProtectedExperience({ children }: { children: ReactNode }) {
  return <Suspense fallback={<CheckingSession />}><SessionBoundary>{children}</SessionBoundary></Suspense>;
}
