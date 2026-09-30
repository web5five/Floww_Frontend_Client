"use client";
import { useEffect, useRef, useState } from "react";
import { walletAuthAdapter as api, checkWalletBackend } from "./adapter";
import type { WalletSession } from "./types";
import type { WalletProvider } from "./wallet";
import { account, chain } from "./wallet";
import { useLocale } from "@/lib/i18n";

const authErrors = {
  status: ["서버 로그인 상태를 확인하지 못했습니다.", "Could not check the server sign-in status."],
  expired: ["로그인 세션이 만료되었습니다. 다시 로그인해 주세요.", "Your sign-in session has expired. Please sign in again."],
  logout: ["로그아웃의 서버 반영을 확인하지 못했습니다. 다시 로그아웃해 주세요.", "Could not confirm sign-out with the server. Please try signing out again."],
  chain: ["지원하는 로그인 네트워크로 변경한 뒤 다시 연결해 주세요.", "Switch to a supported sign-in network, then reconnect."],
  rejected: ["로그인 서명을 거절했습니다. 인증되지 않았습니다.", "You rejected the sign-in signature. You are not signed in."],
  configuration: ["백엔드 연결 설정 필요 · 서버 주소와 인증 설정을 확인해 주세요.", "Server connection needs configuration. Check the server address and authentication settings."],
  unavailable: ["서버가 아직 응답하지 않습니다. 지갑 연결은 유지됩니다. 잠시 후 로그인 메시지 서명 버튼으로 다시 시도해 주세요.", "The server is not responding yet. Your wallet stays connected. Try signing the sign-in message again shortly."],
  nonce: ["로그인 메시지가 만료되었습니다. 버튼을 눌러 새 메시지를 요청해 주세요.", "The sign-in message expired. Select the button to request a new one."],
  rate: ["요청이 많습니다. 잠시 후 직접 다시 시도해 주세요.", "Too many requests. Please try again shortly."],
  general: ["로그인을 검증하지 못했습니다. 서버 설정과 지갑 상태를 확인한 뒤 다시 시도해 주세요.", "Could not verify sign-in. Check the server settings and wallet status, then try again."],
} as const;
type AuthError = keyof typeof authErrors;

type Connection = { address: string; chainId: string };
/** Server remains the authority. No session is synthesized from a wallet address. */
export function useWalletAuth() {
  const { t } = useLocale();
  const [enabled, setEnabled] = useState(false);
  const [supportedChainIds, setSupportedChainIds] = useState<string[]>([]);
  const [mode, setMode] = useState("local-session");
  const [businessReady, setBusinessReady] = useState(true);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [errorCode, setError] = useState<AuthError | "">("");
  const serial = useRef(0);
  const pending = useRef(false);
  const loggingOut = useRef(false);
  const enabledRef = useRef(false);
  useEffect(() => {
    let active = true;
    const lifecycle = serial;
    const init = async () => {
      const version = lifecycle.current;
      try {
        const result = await fetch("/api/wallet-auth/config", { cache: "no-store" }).then(r => r.json());
        if (!active) return;
        enabledRef.current = result.enabled === true; setEnabled(enabledRef.current);
        setMode(result.mode ?? "local-session"); setBusinessReady(result.businessReady !== false);
        setSupportedChainIds(Array.isArray(result.chainIds) ? result.chainIds.filter((id: unknown) => typeof id === "string" && /^[1-9][0-9]{0,15}$/.test(id)) : []);
        if (enabledRef.current) {
          const s = await api.getSession();
          if (active && lifecycle.current === version) setSession(s && Date.parse(s.expiresAt) > Date.now() ? s : null);
        }
      } catch { if (active) setError("status"); }
      finally { if (active) setInitialized(true); }
    };
    void init();
    return () => { active = false; lifecycle.current++; };
  }, []);
  useEffect(() => {
    if (!session) return;
    const expire = () => {
      if (Date.parse(session.expiresAt) <= Date.now()) {
        serial.current++;
        setSession(null); setError("expired");
      }
    };
    const timer = setTimeout(expire, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    window.addEventListener("focus", expire);
    document.addEventListener("visibilitychange", expire);
    return () => { clearTimeout(timer); window.removeEventListener("focus", expire); document.removeEventListener("visibilitychange", expire); };
  }, [session]);
  async function logout() {
    if (loggingOut.current) return;
    serial.current++; setSession(null); setPhase("idle");
    if (!enabledRef.current) return;
    loggingOut.current = true;
    try { await api.logout(); setError(""); } catch { setError("logout"); }
    finally { loggingOut.current = false; }
  }
  async function login(connection: Connection, provider: WalletProvider) {
    if (!enabledRef.current || pending.current || loggingOut.current) return;
    if (supportedChainIds.length && !supportedChainIds.includes(BigInt(connection.chainId).toString())) { setError("chain"); return; }
    pending.current = true; const version = ++serial.current; setError(""); setPhase("requesting_challenge");
    const current = () => version === serial.current;
    try {
      const chainId = BigInt(connection.chainId).toString(10);
      if (mode === "team-jwt") {
        setPhase("checking_server");
        const health = await checkWalletBackend();
        if (!current()) return;
        if (health.ready !== true) throw new Error("AUTH_UPSTREAM_UNAVAILABLE");
        setPhase("requesting_challenge");
      }
      const challenge = await api.getChallenge({ address: connection.address, chainId });
      if (!current()) return;
      // Refuse a message for another website/account/chain or one which has already expired.
      const lines = challenge.message.split("\n");
      const team = challenge.format === "team-jwt";
      if (lines.length !== 11 || lines[2] !== "" || lines[4] !== "" || !/^Nonce: [a-zA-Z0-9]{8,64}$/.test(lines[8]) || lines[10] !== `Expiration Time: ${challenge.expiresAt}`
        || !Number.isFinite(Date.parse(lines[9]?.slice(11))) || Date.parse(lines[9].slice(11)) > Date.now() + 30000
        || lines[0] !== `${team ? location.origin : location.host} wants you to sign in with your Ethereum account:` || lines[1]?.toLowerCase() !== connection.address.toLowerCase()
        || !lines.includes(`URI: ${location.origin}${team ? "" : "/login"}`) || !lines.includes(`Chain ID: ${chainId}`) || !lines.includes("Version: 1")
        || !lines.includes(team ? "Sign in to Floww" : "Sign in to Floww. This does not authorize spending.") || !Number.isFinite(Date.parse(challenge.expiresAt)) || Date.parse(challenge.expiresAt) <= Date.now()) throw new Error("WRONG_CHALLENGE");
      const checkAccount = async () => {
        if (account(await provider.request({ method: "eth_accounts" }))?.toLowerCase() !== connection.address.toLowerCase() || chain(await provider.request({ method: "eth_chainId" })) !== connection.chainId) throw new Error("WALLET_CHANGED");
      };
      await checkAccount(); if (!current()) return;
      setPhase("awaiting_signature");
      const hex = "0x" + [...new TextEncoder().encode(challenge.message)].map(b => b.toString(16).padStart(2, "0")).join("");
      const signature = await provider.request({ method: "personal_sign", params: [hex, connection.address] });
      if (!current()) return;
      await checkAccount(); if (!current()) return;
      if (typeof signature !== "string" || !/^0x[0-9a-f]{130}$/i.test(signature)) throw new Error("INVALID_SIGNATURE");
      setPhase("verifying");
      const verified = await api.verify({ challengeId: challenge.id, message: challenge.message, signature });
      if (!current()) { await api.logout(); return; }
      if (verified.identity.address.toLowerCase() !== connection.address.toLowerCase() || verified.chainId !== chainId) { await api.logout(); throw new Error("WRONG_IDENTITY"); }
      setSession(verified); setPhase("authenticated");
    } catch (cause) {
      if (current()) {
        setSession(null); setPhase("idle");
        const code = cause instanceof Error ? cause.message : "";
        setError((cause as { code?: number })?.code === 4001 ? "rejected"
          : ["BACKEND_NOT_CONFIGURED", "AUTH_SESSION_NOT_CONFIGURED"].includes(code) ? "configuration"
          : code === "AUTH_UPSTREAM_UNAVAILABLE" || (cause instanceof Error && ["TimeoutError", "TypeError"].includes(cause.name)) ? "unavailable"
          : code === "NONCE_EXPIRED" ? "nonce"
          : code === "TOO_MANY_REQUESTS" ? "rate"
          : "general");
      }
    } finally { pending.current = false; }
  }
  return { enabled, initialized, mode, businessReady, supportedChainIds, session, phase, error: errorCode ? t(authErrors[errorCode][0], authErrors[errorCode][1]) : "", login, logout, busy: !["idle", "authenticated"].includes(phase) };
}
