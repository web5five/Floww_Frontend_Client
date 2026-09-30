"use client";

import { account, chain, type WalletOption, type WalletProvider } from "./wallet.ts";
import type { Locale } from "@/lib/i18n";

export const MAGIC_CHAIN_ID = 11155111;
export const MAGIC_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const key = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY?.trim() ?? "";

export type MagicErrorCode = "CONFIG" | "EMAIL" | "PENDING" | "CANCELLED" | "SDK" | "OTP" | "ACCOUNT" | "CHAIN" | "LOGOUT";
export class MagicLoginError extends Error {
  readonly code: MagicErrorCode;
  constructor(code: MagicErrorCode) { super(code); this.code = code; this.name = "MagicLoginError"; }
}

export function magicConfigured(value = key): boolean {
  return /^pk_[A-Za-z0-9_-]{8,}$/.test(value);
}

const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
type MagicModule = typeof import("magic-sdk");
type MagicSdk = {
  auth: { loginWithEmailOTP(input: { email: string }): PromiseLike<unknown> };
  user: { isLoggedIn(): PromiseLike<boolean>; logout(): PromiseLike<unknown>; onUserLoggedOut?(callback: () => void): void };
  rpcProvider: { request(input: { method: string; params?: unknown[] }): PromiseLike<unknown>; on?(event: string, listener: (...args: unknown[]) => void): void; removeListener?(event: string, listener: (...args: unknown[]) => void): void };
};

type Options = {
  publishableKey?: string;
  loadMagic?: () => Promise<MagicModule>;
  onSessionLost?: () => void;
};

/** OTP creates a provider; only the existing wallet-auth BFF can create a Floww session. */
export function createMagicAdapter(options: Options = {}) {
  const publishableKey = options.publishableKey ?? key;
  const loadMagic = options.loadMagic ?? (() => import("magic-sdk"));
  let generation = 0;
  let pending: Promise<WalletOption> | null = null;
  let active: MagicSdk | null = null;
  let logoutBarrier: Promise<void> = Promise.resolve();
  let logoutFailed = false;
  const logoutWork = new WeakMap<MagicSdk, Promise<unknown>>();

  function queueLogout(sdk: MagicSdk) {
    let work = logoutWork.get(sdk);
    if (!work) {
      work = Promise.resolve().then(() => sdk.user.logout());
      logoutWork.set(sdk, work);
    }
    logoutBarrier = Promise.allSettled([logoutBarrier, work]).then(results => {
      if (results.some(result => result.status === "rejected")) logoutFailed = true;
    });
    return work;
  }

  function cancel() {
    generation++;
    const sdk = active;
    active = null;
    // A pending OTP must settle before logout or another OTP can begin.
    if (sdk && !pending) void queueLogout(sdk).catch(() => {});
  }

  async function disconnect() {
    const sdk = active;
    generation++;
    active = null;
    if (sdk && !pending) {
      try { await queueLogout(sdk); }
      catch { throw new MagicLoginError("LOGOUT"); }
    }
  }

  function connect(email: string, locale: Locale): Promise<WalletOption> {
    if (!magicConfigured(publishableKey)) return Promise.reject(new MagicLoginError("CONFIG"));
    if (!validEmail(email)) return Promise.reject(new MagicLoginError("EMAIL"));
    if (pending) return Promise.reject(new MagicLoginError("PENDING"));
    const run = ++generation;
    const current = () => { if (run !== generation) throw new MagicLoginError("CANCELLED"); };
    const work = async (): Promise<WalletOption> => {
      let sdk: MagicSdk | null = null;
      let stage: "sdk" | "otp" | "account" = "sdk";
      try {
        await logoutBarrier;
        current();
        if (logoutFailed) throw new MagicLoginError("LOGOUT");
        const sdkModule = await loadMagic();
        current();
        if (typeof sdkModule.Magic !== "function") throw new MagicLoginError("SDK");
        sdk = new sdkModule.Magic(publishableKey, {
          network: { rpcUrl: MAGIC_RPC_URL, chainId: MAGIC_CHAIN_ID },
          locale,
          deferPreload: true,
        }) as MagicSdk;
        active = sdk;
        sdk.user.onUserLoggedOut?.(() => {
          if (active === sdk) { cancel(); options.onSessionLost?.(); }
        });
        stage = "otp";
        await sdk.auth.loginWithEmailOTP({ email }); // The returned DID is never used as identity.
        current();
        if (await sdk.user.isLoggedIn() !== true) throw new MagicLoginError("OTP");
        current();
        stage = "account";
        const raw = sdk.rpcProvider;
        if (!raw || typeof raw.request !== "function" || typeof raw.on !== "function" || typeof raw.removeListener !== "function") throw new MagicLoginError("SDK");
        const provider: WalletProvider = {
          request: async input => raw.request(input),
          on: (event, listener) => { raw.on?.(event, listener); },
          removeListener: (event, listener) => { raw.removeListener?.(event, listener); },
        };
        const address = account(await provider.request({ method: "eth_accounts" }));
        current();
        if (!address) throw new MagicLoginError("ACCOUNT");
        const chainId = chain(await provider.request({ method: "eth_chainId" }));
        current();
        if (!chainId || BigInt(chainId) !== BigInt(MAGIC_CHAIN_ID)) throw new MagicLoginError("CHAIN");
        return { id: "magic", name: "Magic", provider };
      } catch (cause) {
        if (sdk) { try { await queueLogout(sdk); } catch { /* A failed barrier prevents the next OTP. */ } }
        if (active === sdk) active = null;
        if (run !== generation) throw new MagicLoginError("CANCELLED");
        if (cause instanceof MagicLoginError) throw cause;
        throw new MagicLoginError(stage === "sdk" ? "SDK" : stage === "otp" ? "OTP" : "ACCOUNT");
      }
    };
    const promise = work().finally(() => { if (pending === promise) pending = null; });
    pending = promise;
    return promise;
  }

  return { connect, cancel, disconnect, isPending: () => pending !== null };
}
