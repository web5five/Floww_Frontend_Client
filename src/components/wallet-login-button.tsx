"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useWallet } from "./wallet-provider";

/** Reusable wallet entry point for the overview and header. */
export function WalletLoginButton({ className }: { className?: string }) {
  const router = useRouter();
  const toolkit = useAccount();
  const { connectModalOpen } = useConnectModal();
  const { auth, connection, wallets, discover } = useWallet();
  const [unavailable, setUnavailable] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (unavailable) dialog.current?.showModal(); else dialog.current?.close(); }, [unavailable]);
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
  return <><ConnectButton.Custom>
    {({ mounted, openConnectModal }) => <button type="button" className={className ?? "button primary"}
      onClick={() => {
        if (authenticated) router.push("/dashboard");
        else if (connection) router.push("/login");
        else if (!wallets.length && !process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()) setUnavailable(true);
        else if (mounted && openConnectModal) { requested.current = true; modalSeen.current = false; openConnectModal(); }
        else router.push("/login");
      }}>
      {authenticated ? `${connection.address.slice(0, 6)}…${connection.address.slice(-4)}` : connection ? "로그인 계속하기" : "지갑 연결"}
    </button>}
  </ConnectButton.Custom><dialog ref={dialog} aria-labelledby="wallet-unavailable-title" onCancel={() => setUnavailable(false)} style={{ border: "1px solid #ddd", borderRadius: 20, padding: 28, maxWidth: "min(440px, calc(100vw - 32px))" }}><h2 id="wallet-unavailable-title">연결할 지갑을 찾지 못했어요</h2><p>MetaMask가 설치된 브라우저나 지갑 앱에서 Floww를 열어 주세요.</p><div className="api-actions"><button className="button secondary" type="button" onClick={() => { discover(); setUnavailable(false); }}>다시 찾기</button><button className="button primary" type="button" onClick={() => setUnavailable(false)}>닫기</button></div></dialog></>;
}
