"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useWallet } from "./wallet-provider";
export function Header() {
  const path = usePathname();
  const { connection, auth } = useWallet();
  return <header className="site-header"><Link className="wordmark" href="/" aria-label="Floww 홈"><span className="logo-symbol" aria-hidden="true"><i /><i /><i /></span>Floww<span>®</span></Link><nav aria-label="메인 메뉴"><Link href="/" aria-current={path === "/" ? "page" : undefined}>Overview</Link><Link href="/pharmacy" aria-current={path === "/pharmacy" ? "page" : undefined}>약국 구매</Link><Link href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined}>Dashboard</Link><Link href="/login" aria-current={path === "/login" ? "page" : undefined}>{auth.session ? "로그인됨" : connection ? "지갑 연결됨" : "지갑 로그인"}</Link></nav><Link href="/pharmacy" className="button primary header-cta">구매 데모 시작 <ArrowUpRight size={17} /></Link></header>;
}
