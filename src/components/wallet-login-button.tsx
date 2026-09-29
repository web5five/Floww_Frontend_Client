"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "./wallet-provider";
import { WalletConnectDialog } from "./wallet-connect-dialog";

/** Reusable wallet entry point for the overview and header. */
export function WalletLoginButton({ className }: { className?: string }) {
  const router = useRouter();
  const { auth, connection } = useWallet();
  const [open, setOpen] = useState(false);
  const authenticated = !!auth.session && !!connection && auth.session.identity.address.toLowerCase() === connection.address.toLowerCase();
  return <><button type="button" className={className ?? "button primary"} onClick={() => {
    if (authenticated) router.push("/dashboard");
    else if (connection) router.push("/login");
    else setOpen(true);
  }}>{authenticated ? `${connection.address.slice(0, 6)}…${connection.address.slice(-4)}` : connection ? "로그인 계속하기" : "지갑 연결"}</button><WalletConnectDialog open={open} onClose={() => setOpen(false)} /></>;
}
