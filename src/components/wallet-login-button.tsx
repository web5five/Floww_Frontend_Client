"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "./wallet-provider";
import { WalletConnectDialog } from "./wallet-connect-dialog";
import { useLocale } from "@/lib/i18n";

/** Reusable wallet entry point for the overview and header. */
export function WalletLoginButton({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const { auth, connection } = useWallet();
  const [open, setOpen] = useState(false);
  const authenticated = !!auth.session && !!connection && auth.session.identity.address.toLowerCase() === connection.address.toLowerCase();
  return <><button type="button" aria-label={auth.session ? t("지갑 계정", "Wallet account") : connection ? t("로그인 계속하기", "Continue sign-in") : t("지갑 연결", "Connect wallet")} className={className ?? "button primary"} onClick={() => {
    if (auth.session || connection) router.push("/login");
    else setOpen(true);
  }}>{authenticated ? `${connection.address.slice(0, 6)}…${connection.address.slice(-4)}` : connection ? t("로그인 계속하기", "Continue sign-in") : t("지갑 연결", "Connect wallet")}</button><WalletConnectDialog open={open} onClose={() => setOpen(false)} /></>;
}
