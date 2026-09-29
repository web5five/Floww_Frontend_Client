"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";
import { useWallet } from "./wallet-provider";
import { authConnectionNotice } from "@/lib/auth/adapter";
import { WalletConnectDialog } from "./wallet-connect-dialog";
import styles from "./wallet-login.module.css";

export function WalletLogin() {
  const router = useRouter();
  const { disconnect: disconnectToolkit } = useDisconnect();
  const { auth, login, connection, busy, notice, disconnect } = useWallet();
  const redirectAfterLogin = useRef(false);
  const [open, setOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  useEffect(() => { if (redirectAfterLogin.current && auth.phase === "authenticated" && auth.session && connection) { redirectAfterLogin.current = false; router.push("/dashboard"); } }, [auth.phase, auth.session, connection, router]);
  const unsupportedChain = !!connection && auth.supportedChainIds.length > 0 && !auth.supportedChainIds.includes(BigInt(connection.chainId).toString());
  const network = connection ? BigInt(connection.chainId) === BigInt(11155111) ? "Sepolia" : `Chain ${BigInt(connection.chainId).toString()}` : "";
  return <main id="main" className={`page-shell ${styles.shell}`}>
    <div className={styles.intro}><span className="eyebrow">FLOWW · WALLET LOGIN</span><h1>지갑으로 로그인하세요<span>.</span></h1><p>지갑 연결 후 로그인 메시지를 확인하고 서명합니다. 구매 승인은 나중에 별도로 요청합니다.</p></div>
    <section className={styles.panel} aria-label="지갑 로그인">
      <div className={styles.progress}><span className={connection ? styles.done : styles.active}>1 · 지갑 연결</span><span className={auth.session ? styles.done : connection ? styles.active : ""}>2 · 로그인 서명</span><span className={auth.session ? styles.done : ""}>3 · 완료</span></div>
      {!connection ? <div className={styles.mainStep}><h2>연결할 지갑을 선택하세요</h2><p>브라우저 지갑 또는 모바일 지갑 앱에서 연결할 수 있습니다.</p>{auth.session && <p role="status" className={styles.notice}>서버 로그인 세션이 있습니다. 지갑을 다시 연결해 주소를 확인해 주세요.</p>}{auth.error && <p role="alert" className={styles.alert}>{auth.error}</p>}<button type="button" className="button primary" onClick={() => setOpen(true)}>지갑 선택</button>{auth.session && <div className={styles.actions}><button type="button" className={styles.textButton} onClick={() => void auth.logout()}>로그아웃</button></div>}<p className={styles.hint}>지갑이 없어도 화면을 둘러볼 수 있습니다. 연결 요청이 멈춘 경우 지갑 목록으로 돌아가 다시 시도하세요.</p></div>
        : <div className={styles.mainStep}><div className={styles.connected}><span aria-hidden="true">✓</span><div><strong>{connection.name} 연결됨</strong><small>{connection.address.slice(0, 6)}…{connection.address.slice(-4)} · {network}</small></div></div>
          <h2>{auth.session ? "로그인이 완료되었습니다" : "로그인 메시지를 서명하세요"}</h2>
          <p>{auth.session ? "서버가 지갑 서명을 검증했습니다. 작업 화면으로 이동할 수 있습니다." : "지갑에서 Floww 로그인 메시지를 확인하고 서명해 주세요. 이 서명은 구매나 지출을 승인하지 않습니다."}</p>
          {unsupportedChain && <p role="alert" className={styles.alert}>지원하는 로그인 네트워크로 변경한 뒤 지갑을 다시 연결해 주세요.</p>}
          {!auth.enabled && <p className={styles.hint}>{authConnectionNotice}</p>}
          {!auth.session && <button className="button primary" type="button" disabled={!auth.enabled || auth.busy || busy || unsupportedChain} onClick={() => { redirectAfterLogin.current = true; void login(); }} aria-describedby="wallet-auth-help">{auth.busy ? "로그인 확인 중" : "로그인 메시지 서명"}</button>}
          <p id="wallet-auth-help" className={styles.hint}>{auth.enabled ? "서버가 발급한 로그인 메시지만 서명합니다. 서버 검증에 성공해야 로그인됩니다." : "현재 서버 로그인을 사용할 수 없습니다. 연결 상태는 유지됩니다."}</p>
          {auth.busy && <p role="status" className={styles.notice}>{auth.phase === "checking_server" ? "로그인 서버 연결 확인 중입니다." : auth.phase === "awaiting_signature" ? "지갑에서 로그인 메시지를 확인해 주세요." : "서버 로그인 상태를 확인 중입니다."}</p>}
          {auth.error && <p role="alert" className={styles.alert}>{auth.error}</p>}
          {auth.session && <Link href="/dashboard" className="button primary">작업 화면으로 이동</Link>}
          <div className={styles.actions}><button type="button" className={styles.textButton} onClick={() => void navigator.clipboard.writeText(connection.address).then(() => setCopyNotice("지갑 주소를 복사했습니다.")).catch(() => setCopyNotice("주소를 복사할 수 없습니다."))}>주소 복사</button><button type="button" className={styles.textButton} onClick={() => { disconnect(); disconnectToolkit(); }}>지갑 연결 해제</button>{auth.session && <button type="button" className={styles.textButton} onClick={() => void auth.logout()}>로그아웃</button>}</div>
          {copyNotice && <p role="status">{copyNotice}</p>}
        </div>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <details className={styles.details}><summary>연결 및 로그인 상태 자세히 보기</summary><dl><div><dt>지갑</dt><dd>{connection?.name ?? "연결 전"}</dd></div><div><dt>주소</dt><dd>{connection?.address ?? "연결 전"}</dd></div><div><dt>네트워크</dt><dd>{network || "연결 전"}</dd></div><div><dt>서버 인증</dt><dd>{auth.session ? `완료 · ${new Date(auth.session.expiresAt).toLocaleString("ko-KR")} 만료` : "로그인 전"}</dd></div></dl></details>
    </section>
    <Link className="text-link" href="/dashboard">작업 화면으로 돌아가기 ↗</Link>
    <WalletConnectDialog open={open} onClose={() => setOpen(false)} />
  </main>;
}
