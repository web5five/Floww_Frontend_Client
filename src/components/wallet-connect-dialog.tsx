"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "./wallet-provider";
import { translateWalletNotice, useLocale } from "@/lib/i18n";
import type { MagicErrorCode } from "@/lib/auth/magic";
import styles from "./wallet-login.module.css";

type Choice = "metamask" | "magic" | null;
const magicMessages: Record<MagicErrorCode, [string, string]> = {
  CONFIG: ["Magic 로그인이 아직 설정되지 않았습니다.", "Magic sign-in is not configured yet."],
  EMAIL: ["올바른 이메일 주소를 입력해 주세요.", "Enter a valid email address."],
  PENDING: ["이전 로그인 요청이 아직 끝나지 않았습니다. 완료를 기다리거나 새로고침해 주세요.", "A previous sign-in request is still pending. Wait for it to finish or reload this page."],
  CANCELLED: ["이메일 로그인을 취소했습니다. 이전 요청이 끝나기 전에는 다시 시작할 수 없습니다.", "Email sign-in was cancelled. You cannot start another until the previous request settles."],
  SDK: ["Magic 지갑을 열지 못했습니다. 잠시 후 다시 시도해 주세요.", "Could not open the Magic wallet. Please try again shortly."],
  OTP: ["이메일 인증을 완료하지 못했습니다. 다시 시도해 주세요.", "Could not complete email verification. Please try again."],
  ACCOUNT: ["Magic 지갑 주소를 확인하지 못했습니다. 다시 로그인해 주세요.", "Could not confirm the Magic wallet address. Please sign in again."],
  CHAIN: ["Magic 지갑이 Sepolia에 연결되지 않았습니다. 네트워크 설정을 확인해 주세요.", "The Magic wallet is not on Sepolia. Check the network configuration."],
  LOGOUT: ["이전 지갑 로그아웃을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.", "Could not confirm the previous wallet sign-out. Reload before trying again."],
};

export function WalletConnectDialog({ open, onClose, onLoginStarted }: { open: boolean; onClose(): void; onLoginStarted?(): void }) {
  const { locale, t } = useLocale();
  const { wallets, connection, busy, notice, connect, discover, magic, connectMagic, cancelMagic } = useWallet();
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const [choice, setChoice] = useState<Choice>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<"missing" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);
  const metaMask = wallets.find(wallet => /meta\s?mask/i.test(wallet.name) || (wallet.id === "injected-fallback" && (wallet.provider as { isMetaMask?: boolean }).isMetaMask === true));

  function closeDialog() {
    if (closing.current) return;
    closing.current = true;
    if (magic.pending) cancelMagic();
    setChoice(null); setDevice("desktop"); setEmail(""); setLocalError(null); setCopied(false);
    if (dialog.current?.open) dialog.current.close();
    onClose();
  }
  useEffect(() => {
    if (open && !dialog.current?.open) { closing.current = false; dialog.current?.showModal(); }
    if (!open && dialog.current?.open) { closing.current = true; dialog.current.close(); }
  }, [open]);
  useEffect(() => {
    if (open && connection) {
      closing.current = true;
      onClose();
    }
  }, [open, connection, onClose]);
  function choose(next: Choice) {
    if (choice === "magic" && magic.pending) cancelMagic();
    setChoice(next); setLocalError(null);
  }
  async function copyCurrentUrl() {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); }
    catch { setLocalError("copy"); }
  }
  const localMessage = localError === "missing" ? t("이 브라우저에서 MetaMask를 찾지 못했습니다. 확장 프로그램을 설치하거나 MetaMask 앱의 브라우저에서 열어 주세요.", "MetaMask was not found in this browser. Install the extension or open Floww in the MetaMask app browser.")
    : localError === "copy" ? t("주소를 복사할 수 없습니다. 브라우저 주소를 직접 확인해 주세요.", "Could not copy the address. Check the browser address directly.") : "";
  const magicMessage = magic.error ? t(magicMessages[magic.error][0], magicMessages[magic.error][1]) : "";

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="wallet-dialog-title" onCancel={event => { event.preventDefault(); closeDialog(); }} onClose={() => {
    setChoice(null); setDevice("desktop"); setEmail(""); setLocalError(null); setCopied(false);
    if (!closing.current) closeDialog();
  }}>
    <div className={styles.dialogTop}>
      <button type="button" className={styles.back} onClick={() => choice ? choose(null) : closeDialog()}>{choice ? t("← 로그인 방법", "← Sign-in methods") : t("닫기", "Close")}</button>
      <button type="button" className={styles.close} aria-label={t("닫기", "Close")} onClick={closeDialog}>×</button>
    </div>
    {!choice ? <>
      <p className={styles.kicker}>{t("FLOWW · 지갑 로그인", "FLOWW · WALLET SIGN-IN")}</p><h2 id="wallet-dialog-title">{t("로그인 방법을 선택하세요", "Choose how to sign in")}</h2>
      <p className={styles.description}>{t("두 방법 모두 지갑 주소로 서버 로그인을 완료합니다. 로그인만으로 구매가 승인되지 않습니다.", "Both methods sign in to the server with a wallet address. Sign-in alone does not approve a purchase.")}</p>
      <div className={styles.providerList}>
        <button type="button" className={styles.provider} onClick={() => choose("metamask")}><span className={styles.providerMark} aria-hidden="true">M</span><span><strong>MetaMask</strong><small>{metaMask ? t("이 브라우저에서 감지됨", "Detected in this browser") : t("확장 프로그램 또는 앱 내 브라우저 필요", "Extension or in-app browser needed")}</small></span><span aria-hidden="true">↗</span></button>
        <button type="button" className={styles.provider} onClick={() => choose("magic")}><span className={styles.providerMark} aria-hidden="true">✉</span><span><strong>Magic</strong><small>{magic.configured ? t("이메일 인증으로 지갑 열기", "Open a wallet with email verification") : t("현재 로그인 설정 없음", "Sign-in is not configured")}</small></span><span aria-hidden="true">↗</span></button>
      </div>
    </> : choice === "metamask" ? <>
      <p className={styles.kicker}>MetaMask</p><h2 id="wallet-dialog-title">{t("MetaMask 연결", "Connect MetaMask")}</h2>
      <div className={styles.tabs} role="tablist" aria-label={t("연결할 기기", "Connection device")}><button type="button" role="tab" aria-selected={device === "desktop"} onClick={() => setDevice("desktop")}>{t("데스크톱", "Desktop")}</button><button type="button" role="tab" aria-selected={device === "mobile"} onClick={() => setDevice("mobile")}>{t("모바일", "Mobile")}</button></div>
      {device === "desktop" ? <p className={styles.description}>{metaMask ? t("MetaMask가 감지되었습니다. 연결 요청을 지갑에서 확인해 주세요.", "MetaMask was detected. Confirm the connection request in your wallet.") : t("MetaMask가 감지되지 않았습니다. 확장 프로그램을 설치한 뒤 다시 찾거나 모바일 앱에서 열어 주세요.", "MetaMask was not detected. Install its extension and search again, or open Floww in its mobile app.")}</p>
        : <p className={styles.description}>{t("휴대폰의 MetaMask 앱 내 브라우저에서 Floww를 열어 주세요. 연결 가능한 MetaMask가 감지되면 이 화면에서 연결할 수 있습니다.", "Open Floww in the MetaMask app browser on your phone. If MetaMask is detected here, you can connect from this screen.")}</p>}
      {device === "mobile" && <button type="button" className="button secondary" onClick={() => void copyCurrentUrl()}>{copied ? t("주소 복사됨", "Address copied") : t("이 페이지 주소 복사", "Copy page address")}</button>}
      {metaMask ? <button type="button" className="button primary" disabled={busy} onClick={() => void connect(metaMask)}>{busy ? t("지갑 응답 대기 중", "Waiting for wallet response") : t("MetaMask 연결", "Connect MetaMask")}</button>
        : <button type="button" className={styles.textButton} onClick={() => { discover(); setLocalError("missing"); }}>{t("MetaMask 다시 찾기", "Search for MetaMask again")}</button>}
      {(localMessage || notice) && <p role={localMessage ? "alert" : "status"} className={styles.notice}>{localMessage || translateWalletNotice(notice, locale)}</p>}
    </> : <>
      <p className={styles.kicker}>Magic</p><h2 id="wallet-dialog-title">{t("이메일로 지갑 로그인", "Sign in with email wallet")}</h2>
      <p className={styles.description}>{t("Magic에서 이메일 인증 코드를 보냅니다. 인증 후 Sepolia 지갑으로 Floww 로그인 메시지에 서명합니다.", "Magic sends an email verification code. After verification, its Sepolia wallet signs the Floww sign-in message.")}</p>
      <form onSubmit={event => { event.preventDefault(); if (!magic.configured || magic.pending) return; onLoginStarted?.(); void connectMagic(email.trim(), locale); }}>
        <label className={styles.emailLabel} htmlFor="magic-email">{t("이메일 주소", "Email address")}</label>
        <input id="magic-email" className={styles.emailInput} type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={magic.pending || !magic.configured} />
        <button className="button primary" type="submit" disabled={magic.pending || !magic.configured}>{magic.pending ? t("이메일 인증 및 로그인 진행 중", "Email verification and sign-in in progress") : t("이메일로 계속", "Continue with email")}</button>
      </form>
      {!magic.configured && <p role="status" className={styles.notice}>{t("Magic 로그인이 아직 설정되지 않았습니다. MetaMask를 선택하거나 나중에 다시 시도해 주세요.", "Magic sign-in is not configured yet. Choose MetaMask or try again later.")}</p>}
      {magic.pending && <><p role="status" className={styles.notice}>{t("Magic의 인증 화면에서 이메일 코드를 입력해 주세요. 로그인 서명은 구매 승인이 아닙니다.", "Enter the email code in Magic's verification screen. The sign-in signature is not purchase approval.")}</p><button type="button" className={styles.textButton} onClick={cancelMagic}>{t("인증 취소", "Cancel verification")}</button></>}
      {magicMessage && <p role="alert" className={styles.notice}>{magicMessage}</p>}
      {magic.error === "PENDING" || magic.error === "LOGOUT" ? <button type="button" className={styles.textButton} onClick={() => location.reload()}>{t("새로고침", "Reload page")}</button> : null}
    </>}
    <p className={styles.boundary}>{t("지갑 연결과 로그인은 구매 또는 지출 승인이 아닙니다.", "Wallet connection and sign-in do not approve a purchase or spending.")}</p>
  </dialog>;
}
