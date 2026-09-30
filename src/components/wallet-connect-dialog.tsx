"use client";

import { useEffect, useRef, useState } from "react";
import { useConnect } from "wagmi";
import { useWallet } from "./wallet-provider";
import { type WalletOption } from "@/lib/auth/wallet";
import styles from "./wallet-login.module.css";
import { translateWalletNotice, useLocale } from "@/lib/i18n";

type Choice = "metamask" | "coinbase" | "walletconnect" | string;
type DialogError = "walletconnect" | "missing" | "copy" | "rejected" | "pending" | "disconnected" | "unknown" | "";
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
const providers = [
  { id: "metamask", name: "MetaMask", match: /meta\s?mask/i },
  { id: "coinbase", name: "Coinbase Wallet", match: /coinbase/i },
  { id: "walletconnect", name: "WalletConnect", match: null },
] as const;

export function WalletConnectDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const { locale, t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const intent = useRef(0);
  const { wallets, connection, busy, notice, connect, discover } = useWallet();
  const { connectors, connectAsync } = useConnect();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [sdkBusy, setSdkBusy] = useState(false);
  const [error, setError] = useState<DialogError>("");
  const [copied, setCopied] = useState(false);
  function closeDialog() {
    if (closing.current) return;
    closing.current = true;
    intent.current++;
    setChoice(null); setDevice("desktop"); setError(""); setCopied(false);
    if (dialog.current?.open) dialog.current.close();
    onClose();
  }
  useEffect(() => {
    if (open && !dialog.current?.open) { closing.current = false; dialog.current?.showModal(); }
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => { if (open && connection) onClose(); }, [open, connection, onClose]);
  const matching = (id: Choice): WalletOption | undefined => {
    const standard = providers.find(p => p.id === id);
    return standard?.match ? wallets.find(w => standard.match?.test(w.name)) : wallets.find(w => w.id === id);
  };
  const named = choice ? providers.find(p => p.id === choice) : undefined;
  const wallet = choice ? matching(choice) : undefined;
  const walletName = (name: string) => locale === "en" && name === "브라우저 지갑" ? "Browser wallet" : name;
  const title = named?.name ?? (wallet ? walletName(wallet.name) : t("지갑", "Wallet"));
  const errorMessages: Record<Exclude<DialogError, "">, [string, string]> = {
    walletconnect: ["현재 WalletConnect 연결이 준비되지 않았습니다. 지갑 앱의 브라우저에서 Floww를 열어 주세요.", "WalletConnect is not ready. Open Floww in your wallet app browser."],
    missing: ["이 브라우저에서 해당 지갑을 찾지 못했습니다. 지갑을 설치하거나 지갑 앱의 브라우저에서 열어 주세요.", "This wallet was not found in your browser. Install it or open Floww in your wallet app browser."],
    copy: ["주소를 복사할 수 없습니다. 브라우저 주소를 직접 확인해 주세요.", "Could not copy the address. Check the browser address directly."],
    rejected: ["지갑 연결을 거절했습니다. 원할 때 다시 연결할 수 있습니다.", "Wallet connection rejected. You can connect again whenever you choose."],
    pending: ["지갑에 대기 중인 요청이 있습니다. 지갑 화면을 확인해 주세요.", "A request is pending in your wallet. Check your wallet screen."],
    disconnected: ["지갑 또는 네트워크 연결이 끊겼습니다.", "Wallet or network connection lost."],
    unknown: ["지갑 연결을 확인하지 못했습니다. 지갑 상태를 확인하고 다시 시도해 주세요.", "Could not confirm the wallet connection. Check your wallet and try again."],
  };
  const errorMessage = error ? t(errorMessages[error][0], errorMessages[error][1]) : "";
  const sdkConnector = connectors.find(c => c.id === "walletConnect");
  async function requestConnection() {
    if (!choice || busy || sdkBusy) return;
    const request = ++intent.current;
    setError("");
    if (choice === "walletconnect") {
      if (!projectId || !sdkConnector) { setError("walletconnect"); return; }
      setSdkBusy(true);
      try { await connectAsync({ connector: sdkConnector }); }
      catch (cause) { if (request === intent.current) { const code = (cause as { code?: unknown } | null)?.code; setError(code === 4001 ? "rejected" : code === -32002 ? "pending" : code === 4900 || code === 4901 ? "disconnected" : "unknown"); } }
      finally { setSdkBusy(false); }
      return;
    }
    if (!wallet) { setError("missing"); return; }
    await connect(wallet);
  }
  async function copyCurrentUrl() {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); }
    catch { setError("copy"); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="wallet-dialog-title" onCancel={event => { event.preventDefault(); closeDialog(); }} onClose={() => { if (!closing.current) closeDialog(); }}>
    <div className={styles.dialogTop}>
      <button type="button" className={styles.back} onClick={() => choice ? (intent.current++, setChoice(null), setError("")) : closeDialog()}>{choice ? t("← 지갑 목록", "← Wallet list") : t("닫기", "Close")}</button>
      <button type="button" className={styles.close} aria-label={t("닫기", "Close")} onClick={closeDialog}>×</button>
    </div>
    {!choice ? <>
      <p className={styles.kicker}>{t("FLOWW · 지갑", "FLOWW · WALLET")}</p><h2 id="wallet-dialog-title">{t("지갑을 선택하세요", "Choose a wallet")}</h2>
      <p className={styles.description}>{t("연결할 지갑을 고르세요. 로그인 서명은 연결 후 직접 요청합니다.", "Choose a wallet to connect. You request the sign-in signature separately after connecting.")}</p>
      <div className={styles.providerList}>
        {providers.map(provider => <button type="button" className={styles.provider} key={provider.id} onClick={() => { setChoice(provider.id); setError(""); }}>
          <span className={styles.providerMark} aria-hidden="true">{provider.id === "metamask" ? "M" : provider.id === "coinbase" ? "C" : "W"}</span>
          <span><strong>{provider.name}</strong><small>{provider.id === "walletconnect" ? projectId ? t("모바일 지갑 연결", "Mobile wallet connection") : t("현재 연결 설정 없음", "Connection unavailable") : matching(provider.id) ? t("이 브라우저에서 감지됨", "Detected in this browser") : t("설치 여부 확인", "Check installation")}</small></span><span aria-hidden="true">↗</span>
        </button>)}
        {wallets.filter(w => !providers.some(p => p.match?.test(w.name))).map(w => <button type="button" className={styles.provider} key={w.id} onClick={() => { setChoice(w.id); setError(""); }}><span className={styles.providerMark} aria-hidden="true">◈</span><span><strong>{walletName(w.name)}</strong><small>{t("이 브라우저에서 감지됨", "Detected in this browser")}</small></span><span aria-hidden="true">↗</span></button>)}
      </div>
      <button type="button" className={styles.textButton} onClick={discover}>{t("지갑 다시 찾기", "Search for wallets again")}</button>
    </> : <>
      <p className={styles.kicker}>{t("FLOWW · 지갑", "FLOWW · WALLET")}</p><h2 id="wallet-dialog-title">{title} {t("연결", "connection")}</h2>
      <div className={styles.tabs} role="tablist" aria-label={t("연결할 기기", "Connection device")}><button type="button" role="tab" aria-selected={device === "desktop"} onClick={() => setDevice("desktop")}>{t("데스크톱", "Desktop")}</button><button type="button" role="tab" aria-selected={device === "mobile"} onClick={() => setDevice("mobile")}>{t("모바일", "Mobile")}</button></div>
      {choice === "walletconnect" ? projectId ? <><p className={styles.description}>{t("연결을 누르면 WalletConnect가 실제 지갑 연결 화면을 엽니다. 연결 전에는 QR을 표시하지 않습니다.", "Connect opens the actual WalletConnect screen. A QR code is not shown before connecting.")}</p><button type="button" className="button primary" disabled={sdkBusy} onClick={() => void requestConnection()}>{sdkBusy ? t("지갑 연결 대기 중", "Waiting for wallet") : t("WalletConnect 열기", "Open WalletConnect")}</button></> : <p className={styles.description}>{t("현재 WalletConnect 연결 설정이 없어 QR 페어링을 제공할 수 없습니다. 설치된 브라우저 지갑을 선택하거나 모바일 지갑 앱의 브라우저에서 이 페이지를 열어 주세요.", "WalletConnect QR pairing is unavailable because it is not configured. Choose an installed browser wallet or open this page in a mobile wallet app browser.")}</p>
        : device === "desktop" ? <><p className={styles.description}>{wallet ? `${walletName(wallet.name)} ${t("지갑이 감지되었습니다. 연결 요청을 지갑에서 확인해 주세요.", "wallet detected. Confirm the connection request in your wallet.")}` : `${title} ${t("지갑이 감지되지 않았습니다. 설치 후 다시 찾거나 모바일 지갑 앱에서 열어 주세요.", "wallet was not detected. Install it and search again, or open the page in a mobile wallet app.")}`}</p>{wallet && <button type="button" className="button primary" disabled={busy} onClick={() => void requestConnection()}>{busy ? t("지갑 응답 대기 중", "Waiting for wallet response") : `${walletName(wallet.name)} ${t("연결", "Connect")}`}</button>}</>
        : <><p className={styles.description}>{t("휴대폰의", "Open the Floww address in the")} {title} {t("앱 내 브라우저에서 Floww 주소를 열면 해당 앱의 지갑으로 연결할 수 있습니다. 이 브라우저에서 지갑이 감지된 경우 여기서 연결할 수도 있습니다.", "app browser on your phone to connect its wallet. If this browser detects the wallet, you can connect here too.") }</p><button type="button" className="button secondary" onClick={() => void copyCurrentUrl()}>{copied ? t("주소 복사됨", "Address copied") : t("이 페이지 주소 복사", "Copy page address")}</button>{wallet && <button type="button" className="button primary" disabled={busy} onClick={() => void requestConnection()}>{busy ? t("지갑 응답 대기 중", "Waiting for wallet response") : `${walletName(wallet.name)} ${t("연결", "Connect")}`}</button>}</>}
      {!wallet && choice !== "walletconnect" && <button type="button" className={styles.textButton} onClick={discover}>{t("지갑 다시 찾기", "Search for wallets again")}</button>}
      {(error || notice) && <p role={error ? "alert" : "status"} className={styles.notice}>{errorMessage || translateWalletNotice(notice, locale)}</p>}
      <p className={styles.boundary}>{t("지갑 연결만으로 로그인이나 구매 승인이 완료되지 않습니다.", "Connecting a wallet does not complete sign-in or purchase approval.")}</p>
    </>}
  </dialog>;
}
