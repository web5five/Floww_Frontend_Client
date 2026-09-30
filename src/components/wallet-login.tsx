"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDisconnect } from "wagmi";
import { useWallet } from "./wallet-provider";
import { authConnectionNotice } from "@/lib/auth/adapter";
import { WalletConnectDialog } from "./wallet-connect-dialog";
import styles from "./wallet-login.module.css";
import { loginReturnTo } from "@/lib/auth/return-to";
import { translateWalletNotice, useLocale } from "@/lib/i18n";

export function WalletLogin() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const returnTo = loginReturnTo(useSearchParams().get("returnTo"));
  const { disconnect: disconnectToolkit } = useDisconnect();
  const { auth, login, connection, busy, notice, disconnect } = useWallet();
  const redirectAfterLogin = useRef(false);
  const [open, setOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState<"copied" | "failed" | "">("");
  useEffect(() => { if (redirectAfterLogin.current && auth.phase === "authenticated" && auth.session && connection) { redirectAfterLogin.current = false; router.replace(returnTo); } }, [auth.phase, auth.session, connection, router, returnTo]);
  const unsupportedChain = !!connection && auth.supportedChainIds.length > 0 && !auth.supportedChainIds.includes(BigInt(connection.chainId).toString());
  const network = connection ? BigInt(connection.chainId) === BigInt(11155111) ? "Sepolia" : `Chain ${BigInt(connection.chainId).toString()}` : "";
  return <main id="main" className={`page-shell ${styles.shell}`}>
    <div className={styles.intro}><span className="eyebrow"><span className={styles.flowwLabel}>FLOWW</span> · {t("지갑 로그인", "WALLET LOGIN")}</span><h1>{t("지갑으로 로그인하세요", "Sign in with your wallet")}<span>.</span></h1><p>{t("지갑 연결 후 로그인 메시지를 확인하고 서명합니다. 구매 승인은 나중에 별도로 요청합니다.", "Connect your wallet, review and sign the sign-in message. Purchase approval is requested separately later.")}</p></div>
    <section className={styles.panel} aria-label={t("지갑 로그인", "Wallet sign-in")}>
      <div className={styles.progress}><span className={connection ? styles.done : styles.active}>{t("1 · 연결", "1 · Connect")}</span><span className={auth.session ? styles.done : connection ? styles.active : ""}>{t("2 · 로그인 서명", "2 · Sign in")}</span><span className={auth.session ? styles.done : ""}>{t("3 · 완료", "3 · Done")}</span></div>
      {!connection ? <div className={styles.mainStep}><h2>{t("로그인 방법을 선택하세요", "Choose how to sign in")}</h2><p>{t("MetaMask 지갑을 연결하거나 Magic 이메일 인증으로 지갑을 열 수 있습니다.", "Connect MetaMask or open a wallet with Magic email verification.")}</p>{auth.session && <p role="status" className={styles.notice}>{t("서버 로그인 세션이 있습니다. 지갑을 다시 연결해 주소를 확인해 주세요.", "A server session exists. Reconnect your wallet to confirm its address.")}</p>}{auth.error && <p role="alert" className={styles.alert}>{auth.error}</p>}<button type="button" className="button primary" onClick={() => setOpen(true)}>{t("지갑 선택", "Choose wallet")}</button>{auth.session && <div className={styles.actions}><button type="button" className={styles.textButton} onClick={() => void auth.logout()}>{t("로그아웃", "Sign out")}</button></div>}<p className={styles.hint}>{t("지갑이 없어도 화면을 둘러볼 수 있습니다. 연결 요청이 멈춘 경우 지갑 목록으로 돌아가 다시 시도하세요.", "You can browse without a wallet. If connecting stalls, return to the wallet list and try again.")}</p></div>
        : <div className={styles.mainStep}><div className={styles.connected}><span aria-hidden="true">✓</span><div><strong>{locale === "en" && connection.name === "브라우저 지갑" ? "Browser wallet" : connection.name} {t("연결됨", "connected")}</strong><small>{connection.address.slice(0, 6)}…{connection.address.slice(-4)} · {network}</small></div></div>
          <h2>{auth.session ? t("로그인이 완료되었습니다", "Sign-in complete") : t("로그인 메시지를 서명하세요", "Sign the sign-in message")}</h2>
          <p>{auth.session ? t("서버가 지갑 서명을 검증했습니다. 작업 화면으로 이동할 수 있습니다.", "The server verified your wallet signature. You can continue to your Tasks.") : t("지갑에서 Floww 로그인 메시지를 확인하고 서명해 주세요. 이 서명은 구매나 지출을 승인하지 않습니다.", "Review and sign the Floww sign-in message in your wallet. This signature does not approve a purchase or spending.")}</p>
          {unsupportedChain && <p role="alert" className={styles.alert}>{t("지원하는 로그인 네트워크로 변경한 뒤 지갑을 다시 연결해 주세요.", "Switch to a supported sign-in network, then reconnect your wallet.")}</p>}
          {!auth.enabled && <p className={styles.hint}>{locale === "ko" ? authConnectionNotice : "Sign-in is currently unavailable. Please try again later."}</p>}
          {!auth.session && <button className="button primary" type="button" disabled={!auth.enabled || auth.busy || busy || unsupportedChain} onClick={() => { redirectAfterLogin.current = true; void login(); }} aria-describedby="wallet-auth-help">{auth.busy ? t("로그인 확인 중", "Checking sign-in") : t("로그인 메시지 서명", "Sign sign-in message")}</button>}
          <p id="wallet-auth-help" className={styles.hint}>{auth.enabled ? t("서버가 발급한 로그인 메시지만 서명합니다. 서버 검증에 성공해야 로그인됩니다.", "Only sign the message issued by the server. Sign-in completes after server verification.") : t("현재 서버 로그인을 사용할 수 없습니다. 연결 상태는 유지됩니다.", "Server sign-in is unavailable. Your wallet connection stays active.")}</p>
          {auth.busy && <p role="status" className={styles.notice}>{auth.phase === "checking_server" ? t("로그인 서버 연결 확인 중입니다.", "Checking the sign-in server.") : auth.phase === "awaiting_signature" ? t("지갑에서 로그인 메시지를 확인해 주세요.", "Check the sign-in message in your wallet.") : t("서버 로그인 상태를 확인 중입니다.", "Checking server sign-in status.")}</p>}
          {auth.error && <p role="alert" className={styles.alert}>{auth.error}</p>}
          {auth.session && <Link href={returnTo} className="button primary">{t("작업 화면으로 이동", "Continue to Tasks")}</Link>}
          <div className={styles.actions}><button type="button" className={styles.textButton} onClick={() => void navigator.clipboard.writeText(connection.address).then(() => setCopyNotice("copied")).catch(() => setCopyNotice("failed"))}>{t("주소 복사", "Copy address")}</button><button type="button" className={styles.textButton} onClick={() => { disconnect(); disconnectToolkit(); }}>{t("지갑 연결 해제", "Disconnect wallet")}</button>{auth.session && <button type="button" className={styles.textButton} onClick={() => void auth.logout()}>{t("로그아웃", "Sign out")}</button>}</div>
          {copyNotice && <p role="status">{copyNotice === "copied" ? t("지갑 주소를 복사했습니다.", "Wallet address copied.") : t("주소를 복사할 수 없습니다.", "Could not copy the address.")}</p>}
        </div>}
      {notice && <p role="status" className={styles.notice}>{translateWalletNotice(notice, locale)}</p>}
      <details className={styles.details}><summary>{t("연결 및 로그인 상태 자세히 보기", "Connection and sign-in details")}</summary><dl><div><dt>{t("지갑", "Wallet")}</dt><dd>{connection?.name === "브라우저 지갑" && locale === "en" ? "Browser wallet" : connection?.name ?? t("연결 전", "Not connected")}</dd></div><div><dt>{t("주소", "Address")}</dt><dd>{connection?.address ?? t("연결 전", "Not connected")}</dd></div><div><dt>{t("네트워크", "Network")}</dt><dd>{network || t("연결 전", "Not connected")}</dd></div><div><dt>{t("서버 인증", "Server authentication")}</dt><dd>{auth.session ? `${t("완료 · ", "Complete · ")}${new Date(auth.session.expiresAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}${t(" 만료", " expires")}` : t("로그인 전", "Not signed in")}</dd></div></dl></details>
    </section>
    <Link className="text-link" href="/dashboard">{t("작업 화면으로 돌아가기 ↗", "Back to Tasks ↗")}</Link>
    <WalletConnectDialog open={open} onClose={() => setOpen(false)} onLoginStarted={() => { redirectAfterLogin.current = true; }} />
  </main>;
}
