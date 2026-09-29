"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./wallet-provider";
export function Header() {
  const path = usePathname();
  const { connection, auth } = useWallet();
  return <header className="site-header"><Link className="wordmark" href="/" aria-label="Floww 홈"><span className="logo-symbol" aria-hidden="true"><i /><i /><i /></span>Floww<span>®</span></Link><nav aria-label="메인 메뉴"><Link href="/" aria-current={path === "/" ? "page" : undefined}>Overview</Link><Link href="/pharmacy" aria-current={path === "/pharmacy" ? "page" : undefined}>구매 시나리오</Link><Link href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined}>내 작업</Link></nav><Link href="/login" aria-current={path === "/login" ? "page" : undefined} className="button primary header-login">{auth.session ? `${auth.session.identity.address.slice(0, 6)}…${auth.session.identity.address.slice(-4)}` : connection ? "로그인 계속" : "지갑 로그인"}</Link></header>;
}
