"use client";
import Link from "next/link";
import { Wallet, ShieldCheck } from "lucide-react";
import { useWallet } from "./wallet-provider";
import { authConnectionNotice } from "@/lib/auth/adapter";
import { Card } from "./ui";
export function WalletLogin() {
  const { auth, login, wallets, connection, busy, notice, connect, disconnect, discover } = useWallet();
  const unsupportedChain = !!connection && auth.supportedChainIds.length > 0 && !auth.supportedChainIds.includes(BigInt(connection.chainId).toString());
  return <main id="main" className="page-shell wallet-shell">
    <div className="dashboard-title"><div><span className="eyebrow">FLOWW · WALLET LOGIN</span><h1>당신의 지갑으로 시작하세요<span>.</span></h1><p>지갑 연결과 사용자 인증, 지출 승인을 각각 확인합니다.</p></div></div>
    <div className="wallet-grid"><Card><div className="section-heading"><h2><Wallet size={19} /> 1. 지갑 연결</h2><span className="tag">{auth.session ? "인증됨" : connection ? "연결됨 · 미인증" : "연결 전"}</span></div>
      <p className="form-note">현재 브라우저에서 제공하는 EVM 지갑을 선택하세요. 모바일은 지갑 앱의 내장 브라우저에서 열어주세요. QR 연결은 아직 지원하지 않습니다.</p>
      <div className="wallet-options">{wallets.map(wallet => <button key={wallet.id} className="button secondary" disabled={busy || !!connection} onClick={() => void connect(wallet)}>{wallet.name} 연결</button>)}</div>
      {!wallets.length && <p className="form-note">감지된 지갑이 없습니다. 브라우저 지갑을 준비하거나 지갑 앱에서 이 페이지를 열어주세요.</p>}
      {!connection && <button className="text-link" disabled={busy} onClick={discover}>지갑 다시 찾기</button>}
      {busy && <p role="status">지갑에서 연결 요청을 확인해 주세요.</p>}
      {connection && <dl className="purchase-details"><div><dt>연결 지갑</dt><dd>{connection.name}</dd></div><div><dt>연결 주소</dt><dd>{connection.address}</dd></div><div><dt>네트워크 ID</dt><dd>{connection.chainId}</dd></div><div><dt>인증 상태</dt><dd>{auth.session ? "로그인 완료 · 서버 검증됨" : "로그인 전 · 서버 검증 없음"}</dd></div></dl>}
      {(connection || busy) && <button className="button secondary" onClick={disconnect}>{busy ? "연결 요청 취소" : "지갑 연결 해제"}</button>}
      {notice && <p className="form-note" role="status">{notice}</p>}
    </Card><Card><div className="section-heading"><h2><ShieldCheck size={19} /> 2. 로그인 메시지 서명</h2><span className="tag">{auth.session ? "인증됨" : auth.enabled ? "로그인 대기" : "연결 전"}</span></div>
      <p className="form-note">{auth.enabled ? "지갑 로그인 · 서버 검증" : authConnectionNotice}</p><ol className="wallet-steps"><li>서버가 발급한 일회용 로그인 메시지 확인</li><li>지갑으로 로그인 메시지 서명</li><li>서버의 서명 검증 및 세션 생성</li><li>검증된 지갑 주소로 사용자 식별</li></ol>
      {auth.enabled && auth.supportedChainIds.length > 0 && <p className="form-note">로그인 네트워크: {auth.supportedChainIds.map(id => id === "11155111" ? "Sepolia (11155111)" : id).join(", ")}{unsupportedChain && " · 지갑에서 네트워크를 변경한 뒤 다시 연결해 주세요."}</p>}
      <button className="button primary" disabled={!auth.enabled || !connection || auth.busy || !!auth.session || unsupportedChain} onClick={() => void login()} aria-describedby="wallet-auth-help">{auth.enabled ? "로그인 메시지 서명" : "로그인 서명 (API 연결 전)"}</button>
      <p id="wallet-auth-help" className="form-note">{auth.enabled ? "서버가 발급한 로그인 메시지만 서명합니다. 서버 검증에 성공해야 로그인됩니다." : "백엔드의 메시지 발급·서명 검증·세션 조회·로그아웃 계약을 기다리고 있습니다. 현재는 서명을 요청하거나 로그인 세션을 만들지 않습니다."}</p>
      {auth.busy && <p role="status">{auth.phase === "checking_server" ? "서버 연결을 준비하고 있어요. 서버가 대기 상태였다면 시간이 걸릴 수 있습니다." : auth.phase === "awaiting_signature" ? "지갑에서 로그인 메시지를 확인해 주세요." : "서버 로그인 상태를 확인하고 있습니다."}</p>}
      {auth.session && <p role="status" style={{ overflowWrap: "anywhere" }}>로그인 완료 · {auth.session.identity.address}<br />만료: {new Date(auth.session.expiresAt).toLocaleString("ko-KR")}</p>}
      {auth.error && <p role="alert">{auth.error}</p>}
      {auth.enabled && <button className="button secondary" onClick={() => void auth.logout()}>로그아웃</button>}
      {auth.enabled && auth.mode === "team-jwt" && <p className="form-note">로그아웃은 이 앱의 세션을 해제합니다. 서버 전체 세션 종료 기능은 연결 전입니다.</p>}
      <p className="form-note"><strong>로그인은 구매 승인이 아닙니다.</strong><br />Mandate 확인과 위임된 지출 권한 승인은 별도의 절차입니다. 지갑을 연결해도 실제 구매·결제는 실행하지 않습니다.</p>
    </Card></div><p className="form-note">기존 대시보드는 로컬 데모 및 개발용 API 테스트 영역입니다. 개발용 서버 토큰은 지갑 사용자 인증과 별개입니다.</p><Link className="text-link" href="/pharmacy">구매 데모로 돌아가기 ↗</Link>
  </main>;
}
