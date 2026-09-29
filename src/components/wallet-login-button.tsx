"use client";

import { useEffect, useRef } from "react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useWallet } from "./wallet-provider";

/** Reusable wallet entry point for the overview and header. */
export function WalletLoginButton({ className }: { className?: string }) {
  const router = useRouter();
  const toolkit = useAccount();
  const { connectModalOpen } = useConnectModal();
  const { auth, connection } = useWallet();
  const requested = useRef(false);
  const modalSeen = useRef(false);
  const authenticated = !!auth.session && !!connection && auth.session.identity.address.toLowerCase() === connection.address.toLowerCase();
  useEffect(() => {
    if (requested.current && connectModalOpen) modalSeen.current = true;
    if (requested.current && toolkit.status === "connected" && connection && toolkit.address?.toLowerCase() === connection.address.toLowerCase()) {
      requested.current = false;
      modalSeen.current = false;
      router.push("/login");
    }
  }, [connectModalOpen, toolkit.status, toolkit.address, connection, router]);
  useEffect(() => {
    if (connectModalOpen || !modalSeen.current || toolkit.status !== "disconnected") return;
    const timer = window.setTimeout(() => { if (toolkit.status === "disconnected") { requested.current = false; modalSeen.current = false; } }, 500);
    return () => window.clearTimeout(timer);
  }, [connectModalOpen, toolkit.status]);
  return <ConnectButton.Custom>
    {({ mounted, openConnectModal }) => <button type="button" className={className ?? "button primary"}
      onClick={() => {
        if (authenticated) router.push("/dashboard");
        else if (connection) router.push("/login");
        else if (mounted && openConnectModal) { requested.current = true; modalSeen.current = false; openConnectModal(); }
        else router.push("/login");
      }}>
      {authenticated ? `${connection.address.slice(0, 6)}…${connection.address.slice(-4)}` : connection ? "로그인 계속하기" : "지갑 연결"}
    </button>}
  </ConnectButton.Custom>;
}
