"use client";
import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletLoginButton } from "./wallet-login-button";
export function Header() {
  const path = usePathname();
  return <header className="site-header"><Link className="wordmark" href="/" aria-label="Floww 홈"><BrandMark size={30} decorative />Floww</Link><nav aria-label="메인 메뉴"><Link href="/" aria-current={path === "/" ? "page" : undefined}>Overview</Link><Link href="/pharmacy" aria-current={path === "/pharmacy" ? "page" : undefined}>구매 시나리오</Link><Link href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined}>내 작업</Link></nav><WalletLoginButton className="button primary header-login" /></header>;
}
