"use client";

import { useEffect, useRef, useState } from "react";
import { useConnect } from "wagmi";
import { useWallet } from "./wallet-provider";
import { walletError, type WalletOption } from "@/lib/auth/wallet";
import styles from "./wallet-login.module.css";

type Choice = "metamask" | "coinbase" | "walletconnect" | string;
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
const providers = [
  { id: "metamask", name: "MetaMask", match: /meta\s?mask/i },
  { id: "coinbase", name: "Coinbase Wallet", match: /coinbase/i },
  { id: "walletconnect", name: "WalletConnect", match: null },
] as const;

export function WalletConnectDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const intent = useRef(0);
  const { wallets, connection, busy, notice, connect, discover } = useWallet();
  const { connectors, connectAsync } = useConnect();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [sdkBusy, setSdkBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  function closeDialog() { intent.current++; setChoice(null); setDevice("desktop"); setError(""); setCopied(false); onClose(); }
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => { if (open && connection) onClose(); }, [open, connection, onClose]);
  const matching = (id: Choice): WalletOption | undefined => {
    const standard = providers.find(p => p.id === id);
    return standard?.match ? wallets.find(w => standard.match?.test(w.name)) : wallets.find(w => w.id === id);
  };
  const named = choice ? providers.find(p => p.id === choice) : undefined;
  const wallet = choice ? matching(choice) : undefined;
  const title = named?.name ?? wallet?.name ?? "지갑";
  const sdkConnector = connectors.find(c => c.id === "walletConnect");
  async function requestConnection() {
    if (!choice || busy || sdkBusy) return;
    const request = ++intent.current;
    setError("");
    if (choice === "walletconnect") {
      if (!projectId || !sdkConnector) { setError("현재 WalletConnect 연결이 준비되지 않았습니다. 지갑 앱의 브라우저에서 Floww를 열어 주세요."); return; }
      setSdkBusy(true);
      try { await connectAsync({ connector: sdkConnector }); }
      catch (cause) { if (request === intent.current) setError(walletError(cause)); }
      finally { setSdkBusy(false); }
      return;
    }
    if (!wallet) { setError("이 브라우저에서 해당 지갑을 찾지 못했습니다. 지갑을 설치하거나 지갑 앱의 브라우저에서 열어 주세요."); return; }
    await connect(wallet);
  }
  async function copyCurrentUrl() {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); }
    catch { setError("주소를 복사할 수 없습니다. 브라우저 주소를 직접 확인해 주세요."); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="wallet-dialog-title" onCancel={closeDialog} onClose={closeDialog}>
    <div className={styles.dialogTop}>
      <button type="button" className={styles.back} onClick={() => choice ? (intent.current++, setChoice(null), setError("")) : closeDialog()}>{choice ? "← 지갑 목록" : "닫기"}</button>
      <button type="button" className={styles.close} aria-label="닫기" onClick={closeDialog}>×</button>
    </div>
    {!choice ? <>
      <p className={styles.kicker}>FLOWW · WALLET</p><h2 id="wallet-dialog-title">지갑을 선택하세요</h2>
      <p className={styles.description}>연결할 지갑을 고르세요. 로그인 서명은 연결 후 직접 요청합니다.</p>
      <div className={styles.providerList}>
        {providers.map(provider => <button type="button" className={styles.provider} key={provider.id} onClick={() => { setChoice(provider.id); setError(""); }}>
          <span className={styles.providerMark} aria-hidden="true">{provider.id === "metamask" ? "M" : provider.id === "coinbase" ? "C" : "W"}</span>
          <span><strong>{provider.name}</strong><small>{provider.id === "walletconnect" ? projectId ? "모바일 지갑 연결" : "현재 연결 설정 없음" : matching(provider.id) ? "이 브라우저에서 감지됨" : "설치 여부 확인"}</small></span><span aria-hidden="true">↗</span>
        </button>)}
        {wallets.filter(w => !providers.some(p => p.match?.test(w.name))).map(w => <button type="button" className={styles.provider} key={w.id} onClick={() => { setChoice(w.id); setError(""); }}><span className={styles.providerMark} aria-hidden="true">◈</span><span><strong>{w.name}</strong><small>이 브라우저에서 감지됨</small></span><span aria-hidden="true">↗</span></button>)}
      </div>
      <button type="button" className={styles.textButton} onClick={discover}>지갑 다시 찾기</button>
    </> : <>
      <p className={styles.kicker}>FLOWW · WALLET</p><h2 id="wallet-dialog-title">{title} 연결</h2>
      <div className={styles.tabs} role="tablist" aria-label="연결할 기기"><button type="button" role="tab" aria-selected={device === "desktop"} onClick={() => setDevice("desktop")}>데스크톱</button><button type="button" role="tab" aria-selected={device === "mobile"} onClick={() => setDevice("mobile")}>모바일</button></div>
      {choice === "walletconnect" ? projectId ? <><p className={styles.description}>연결을 누르면 WalletConnect가 실제 지갑 연결 화면을 엽니다. 연결 전에는 QR을 표시하지 않습니다.</p><button type="button" className="button primary" disabled={sdkBusy} onClick={() => void requestConnection()}>{sdkBusy ? "지갑 연결 대기 중" : "WalletConnect 열기"}</button></> : <p className={styles.description}>현재 WalletConnect 연결 설정이 없어 QR 페어링을 제공할 수 없습니다. 설치된 브라우저 지갑을 선택하거나 모바일 지갑 앱의 브라우저에서 이 페이지를 열어 주세요.</p>
        : device === "desktop" ? <><p className={styles.description}>{wallet ? `${wallet.name} 지갑이 감지되었습니다. 연결 요청을 지갑에서 확인해 주세요.` : `${title} 지갑이 감지되지 않았습니다. 설치 후 다시 찾거나 모바일 지갑 앱에서 열어 주세요.`}</p>{wallet && <button type="button" className="button primary" disabled={busy} onClick={() => void requestConnection()}>{busy ? "지갑 응답 대기 중" : `${wallet.name} 연결`}</button>}</>
        : <><p className={styles.description}>휴대폰의 {title} 앱 내 브라우저에서 Floww 주소를 열면 해당 앱의 지갑으로 연결할 수 있습니다. 이 브라우저에서 지갑이 감지된 경우 여기서 연결할 수도 있습니다.</p><button type="button" className="button secondary" onClick={() => void copyCurrentUrl()}>{copied ? "주소 복사됨" : "이 페이지 주소 복사"}</button>{wallet && <button type="button" className="button primary" disabled={busy} onClick={() => void requestConnection()}>{busy ? "지갑 응답 대기 중" : `${wallet.name} 연결`}</button>}</>}
      {!wallet && choice !== "walletconnect" && <button type="button" className={styles.textButton} onClick={discover}>지갑 다시 찾기</button>}
      {(error || notice) && <p role={error ? "alert" : "status"} className={styles.notice}>{error || notice}</p>}
      <p className={styles.boundary}>지갑 연결만으로 로그인이나 구매 승인이 완료되지 않습니다.</p>
    </>}
  </dialog>;
}
