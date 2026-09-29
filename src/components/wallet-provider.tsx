"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { account, chain, isProvider, walletError, type WalletOption } from "@/lib/auth/wallet";
import { useWalletAuth } from "@/lib/auth/use-wallet-auth";

type Connection = { address: string; chainId: string; name: string };
interface WalletContextValue {
  auth: ReturnType<typeof useWalletAuth>;
  login(): Promise<void>;
  wallets: WalletOption[];
  connection: Connection | null;
  busy: boolean;
  notice: string;
  connect(wallet: WalletOption, alreadyConnected?: boolean): Promise<void>;
  disconnect(): void;
  discover(): void;
  requestForOwner(owner: string, method: string, params?: unknown[], allowed?: () => boolean): Promise<unknown>;
}
const WalletContext = createContext<WalletContextValue | null>(null);
export function WalletProvider({ children }: { children: ReactNode }) {
  const auth = useWalletAuth();
  const selected = useRef<WalletOption | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const serial = useRef(0);
  const unsubscribe = useRef<() => void>(() => {});
  const discover = () => window.dispatchEvent(new Event("eip6963:requestProvider"));
  useEffect(() => {
    if (connection && auth.session &&
      (auth.session.identity.address.toLowerCase() !== connection.address.toLowerCase() ||
        auth.session.chainId !== BigInt(connection.chainId).toString())) void auth.logout();
  }, [connection, auth]);
  useEffect(() => {
    const lifecycle = serial;
    const announce = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || !isProvider(detail.provider) || typeof detail.info?.uuid !== "string" || typeof detail.info?.name !== "string") return;
      const option: WalletOption = { id: detail.info.uuid.slice(0, 80), name: detail.info.name.slice(0, 80), provider: detail.provider };
      setWallets(previous => previous.some(w => w.id === option.id || w.provider === option.provider) ? previous : [...previous.filter(w => w.id !== "injected-fallback"), option].slice(0, 20));
    };
    window.addEventListener("eip6963:announceProvider", announce);
    discover();
    const fallback = setTimeout(() => {
      const provider = (window as Window & { ethereum?: unknown }).ethereum;
      if (isProvider(provider)) setWallets(previous => previous.length ? previous : [{ id: "injected-fallback", name: "브라우저 지갑", provider }]);
    }, 250);
    return () => { clearTimeout(fallback); window.removeEventListener("eip6963:announceProvider", announce); unsubscribe.current(); lifecycle.current++; };
  }, []);
  function disconnect() {
    selected.current = null; void auth.logout();
    serial.current++; unsubscribe.current(); unsubscribe.current = () => {};
    pending.current = false; setBusy(false); setConnection(null);
    setNotice("이 앱의 지갑 연결을 해제했습니다. 지갑의 사이트 연결 권한은 지갑 설정에서 관리할 수 있습니다.");
  }
  async function connect(wallet: WalletOption, alreadyConnected = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setNotice(""); setConnection(null);
    unsubscribe.current();
    const attempt = ++serial.current;
    let revision = 0;
    let connected = false;
    const changed = () => {
      revision++;
      if (connected) {
        selected.current = null; void auth.logout();
        serial.current++; setConnection(null); setNotice("지갑 계정 또는 네트워크가 변경되었습니다. 다시 연결하고 로그인해야 합니다.");
        unsubscribe.current();
      }
    };
    const lost = () => {
      selected.current = null; void auth.logout();
      revision++; serial.current++; pending.current = false; setBusy(false); setConnection(null);
      setNotice("지갑 연결이 끊겼습니다. 다시 연결해 주세요."); unsubscribe.current();
    };
    try {
      wallet.provider.on("accountsChanged", changed);
      wallet.provider.on("chainChanged", changed);
      wallet.provider.on("disconnect", lost);
      unsubscribe.current = () => { wallet.provider.removeListener("accountsChanged", changed); wallet.provider.removeListener("chainChanged", changed); wallet.provider.removeListener("disconnect", lost); };
      // RainbowKit has already obtained consent; do not prompt for connection twice.
      const address = account(await wallet.provider.request({ method: alreadyConnected ? "eth_accounts" : "eth_requestAccounts" }));
      const snapshot = revision;
      const chainId = chain(await wallet.provider.request({ method: "eth_chainId" }));
      const latest = account(await wallet.provider.request({ method: "eth_accounts" }));
      if (attempt !== serial.current) return;
      if (!address || !chainId || latest?.toLowerCase() !== address.toLowerCase() || revision !== snapshot) throw new Error("WALLET_CHANGED");
      connected = true;
      selected.current = wallet;
      if (auth.session && (auth.session.identity.address.toLowerCase() !== address.toLowerCase() || auth.session.chainId !== BigInt(chainId).toString())) void auth.logout();
      setConnection({ address, chainId, name: wallet.name });
      setNotice("지갑 연결됨 · 로그인 전. 연결만으로 사용자 인증이나 지출 권한이 생기지 않습니다.");
    } catch (error) {
      if (attempt === serial.current) { unsubscribe.current(); setConnection(null); setNotice(walletError(error)); }
    } finally {
      if (attempt === serial.current) { pending.current = false; setBusy(false); }
    }
  }
  const login = async () => { if (connection && selected.current) await auth.login(connection, selected.current.provider); };
  async function requestForOwner(owner: string, method: string, params: unknown[] = [], allowed: () => boolean = () => true) {
    const wallet = selected.current, revision = serial.current;
    const session = auth.session;
    if (!wallet || !session || !connection || connection.address.toLowerCase() !== owner.toLowerCase() || session.identity.address.toLowerCase() !== owner.toLowerCase() || session.chainId !== "11155111" || !allowed()) throw new Error("지갑 로그인과 연결을 확인하세요.");
    const address = account(await wallet.provider.request({ method: "eth_accounts" }));
    const network = chain(await wallet.provider.request({ method: "eth_chainId" }));
    if (revision !== serial.current || address?.toLowerCase() !== owner.toLowerCase() || !network || BigInt(network) !== BigInt(11155111) || !allowed()) throw new Error("지갑 계정·Sepolia 네트워크 변경 또는 STOP으로 요청을 차단했습니다.");
    // Return transaction hashes even when disconnect happens during the wallet popup:
    // callers persist them before checking STOP again, preventing duplicate sends.
    return wallet.provider.request({ method, params });
  }
  return <WalletContext.Provider value={{ auth, login, wallets, connection, busy, notice, connect, disconnect, discover, requestForOwner }}>{children}</WalletContext.Provider>;
}
export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("WalletProvider is required");
  return value;
}
