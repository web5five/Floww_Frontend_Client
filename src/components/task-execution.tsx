"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWallet } from "./wallet-provider";
import { tasks } from "@/lib/api/task-client";
import { accountApi, assertLive, checkedApproval, checkedDeployment, checkedFunding, checkSignature, validateAccount, type Approval, type Funding, type TaskAccount } from "@/lib/api/task-account";
import type { TaskView } from "@/lib/api/task-types";
import { formatFusdc } from "@/lib/pharmacy-preview";
import { accountProgress } from "@/lib/api/account-evidence";
import { keccak256 } from "ethers";
import { useLocale } from "@/lib/i18n";
import { merchantLabel } from "@/lib/scenario-presentation";
import { WalletRequestFailure } from "@/lib/auth/wallet";

type WalletOperation = { kind: "deploy" | "allowance" | "fund"; hash: string | null; confirmed: boolean; at: string; to?: string; dataHash: string };
type ServerUnknown = { action: "approve" | "payment" | "fulfillment"; fromState: string };
const executionMessages: Record<string, string> = {
  "거래 복구 기록을 읽을 수 없습니다. 중복 지급 방지를 위해 지갑 실행을 잠갔습니다.": "Transaction recovery record could not be read. Wallet execution is locked to prevent duplicate payment.",
  "STOPPED 또는 지갑 세션 변경 · 후속 실행 금지": "STOPPED or wallet session changed \u00b7 further actions blocked.",
  "요청 결과를 확인하지 못했습니다.": "The request result could not be confirmed.",
  "이전 서버 거래 결과를 먼저 확인하세요. 같은 요청을 다시 전송하지 않습니다.": "Check the previous server transaction result first. The same request will not be resent.",
  "기존 지갑 요청 결과를 먼저 확인하세요.": "Check the existing wallet request result first.",
  "거래 결과 불명 · 자동 재전송하지 않습니다.": "Transaction result unknown \u00b7 no automatic resubmission.",
  "Sepolia 거래 제출됨 · 영수증 확인 전에는 성공으로 표시하지 않습니다.": "Sepolia transaction submitted. It will not show as successful until the receipt is verified.",
  "사용자가 지갑 요청을 거절했습니다. 거래를 제출하지 않았습니다.": "The wallet request was rejected. No transaction was submitted.",
  "거래 해시를 받지 못했습니다. 지갑 활동에서 확인하기 전에는 재전송할 수 없습니다.": "No transaction hash was received. Do not resend until wallet activity is checked.",
  "아직 채굴되지 않았습니다. 잠시 후 영수증을 다시 확인하세요.": "The transaction is not mined yet. Recheck the receipt shortly.",
  "영수증 해시 불일치": "Receipt hash does not match.",
  "Sepolia 거래 실패 · 가스는 소모될 수 있습니다. 상태를 다시 조회하세요.": "Sepolia transaction failed. Gas may have been spent. Recheck status.",
  "알 수 없는 영수증 상태": "Receipt status is unknown.",
  "확인된 거래가 요청한 내용과 다릅니다.": "Verified transaction does not match the request.",
  "배포 주소 없음": "Deployment address is missing.",
  "토큰 허용 영수증 확인 · 충전은 별도 요청입니다.": "Token allowance receipt verified. Funding requires a separate request.",
  "충전 영수증 확인 · 서버 잔액을 조회한 뒤 주문을 진행하세요.": "Funding receipt verified. Check server balance before ordering.",
  "정책 통과 및 최신 Mandate를 다시 확인하세요.": "Recheck the policy result and current mandate.",
  "승인 버전 변경": "Approval version changed.",
  "이미 충전된 계정입니다.": "This account is already funded.",
  "충전 잔액 부족": "Insufficient funding balance.",
  "서버 주문 생성됨 · 실제 지급은 다음 버튼으로 요청하세요.": "Server order created. Use the next button to request payment.",
  "서버 지급 상태를 확인하세요.": "Check server payment status.",
  "올바른 거래 해시를 입력하세요.": "Enter a valid transaction hash.",
  "지갑 요청 결과를 확인하지 못했습니다. 거래 상태를 확인하기 전에는 재전송하지 마세요.": "Could not confirm the wallet request result. Do not resend before checking transaction status.",
};
const executionCodes: Record<string, [string, string]> = {
  "ACCOUNT_ATTEMPT_MISMATCH": ["승인된 구매 시도와 계정이 일치하지 않습니다. 작업을 다시 조회하세요.", "The approved purchase attempt does not match the account. Refresh the Task."],
  "ACCOUNT_OWNER_OR_ACTOR_MISMATCH": ["계정 소유자 또는 실행 주체가 일치하지 않습니다. 지갑 연결을 확인하세요.", "Account owner or execution actor does not match. Check the wallet connection."],
  "ACCOUNT_TOKEN_OR_CHAIN_MISMATCH": ["토큰 또는 체인 정보가 일치하지 않습니다. 지갑 네트워크를 확인하세요.", "Token or chain does not match. Check the wallet network."],
  "ACCOUNT_RECIPIENT_OR_AMOUNT_MISMATCH": ["수취인 또는 구매 금액이 검토한 내용과 다릅니다. 승인하지 마세요.", "Recipient or purchase amount differs from what was reviewed. Do not approve."],
  "REVIEW_SNAPSHOT_MISMATCH": ["구매 검토 기록이 일치하지 않습니다. 승인하지 마세요.", "Purchase review snapshot does not match. Do not approve."],
  "ACCOUNT_EXPIRY_MISMATCH": ["계정 승인 기한이 견적 또는 작업 기한과 다릅니다.", "Account deadline differs from quote or Task deadline."],
  "UNKNOWN_ACCOUNT_STATE": ["계정 상태를 확인할 수 없습니다. 거래를 다시 보내지 마세요.", "Account state could not be verified. Do not resend a transaction."],
  "ACCOUNT_ADDRESS_MISSING": ["계정 주소가 없습니다. 배포 거래를 확인하세요.", "Account address is missing. Check the deployment transaction."],
  "TASK_STOPPED_OR_EXPIRED": ["작업이 중단됐거나 기한이 지났습니다. 후속 실행을 진행하지 마세요.", "Task is stopped or expired. Do not continue execution."],
  "UNREVIEWED_DEPLOYMENT_DATA": ["지갑 배포 데이터가 검토한 구매와 다릅니다. 서명하지 마세요.", "Wallet deployment data differs from the reviewed purchase. Do not sign."],
  "TYPED_DATA_SCHEMA_MISMATCH": ["서명 요청 형식이 예상 계약과 다릅니다. 서명하지 마세요.", "Signature request schema differs from the expected contract. Do not sign."],
  "TYPED_DATA_DOMAIN_MISMATCH": ["서명 대상 체인 또는 계정이 다릅니다. 서명하지 마세요.", "Signature chain or account does not match. Do not sign."],
  "TYPED_DATA_MESSAGE_MISMATCH": ["서명할 구매 조건이 검토한 내용과 다릅니다. 서명하지 마세요.", "Purchase terms to sign differ from those reviewed. Do not sign."],
  "TYPED_DATA_DIGEST_MISMATCH": ["서명할 데이터의 검증값이 일치하지 않습니다. 서명하지 마세요.", "Signature data digest does not match. Do not sign."],
  "INVALID_SIGNATURE": ["지갑 서명 형식을 확인할 수 없습니다.", "Wallet signature format could not be verified."],
  "SIGNER_MISMATCH": ["서명자가 로그인 지갑과 다릅니다.", "Signer does not match the signed-in wallet."],
  "FUNDING_MISMATCH": ["충전 정보 또는 승인 상태가 일치하지 않습니다. 잔액을 다시 조회하세요.", "Funding details or approval state do not match. Refresh the balance."],
  "UNREVIEWED_FUNDING_DATA": ["충전 거래 데이터가 검토한 금액과 다릅니다. 지갑에서 승인하지 마세요.", "Funding transaction data differs from the reviewed amount. Do not approve it in the wallet."],
  "INVALID_EXPIRY": ["승인 기한 형식을 확인할 수 없습니다.", "Approval deadline format could not be verified."],
  "INVALID_TASK_ID": ["작업 ID 형식을 확인할 수 없습니다.", "Task ID format could not be verified."],
  "UNAUTHORIZED": ["지갑 로그인이 필요하거나 세션이 만료되었습니다.", "Wallet sign-in is required or the session expired."],
  "UPSTREAM_UNAVAILABLE": ["서버 응답을 확인하지 못했습니다. 계정과 거래 상태를 조회하고 재전송하지 마세요.", "Server response could not be confirmed. Check account and transaction status before resending."],
  "INVALID_RESPONSE": ["서버 응답 형식이 예상과 다릅니다. 실행 전에 상태를 확인하세요.", "Server response differs from the expected contract. Check status before executing."],
  "CHAIN_NOT_READY": ["체인 실행이 준비되지 않았습니다. 지갑 네트워크와 계정 상태를 확인하세요.", "Chain execution is not ready. Check wallet network and account state."],
};
function executionCode(message: string): string | null { return /^([A-Z][A-Z0-9_]{1,63})(?: ·|$)/.exec(message)?.[1] ?? null; }
function localizedExecutionMessage(message: string, locale: "ko" | "en"): string {
  const code = executionCode(message);
  if (code && executionCodes[code]) return executionCodes[code][locale === "ko" ? 0 : 1];
  if (locale === "ko") return Object.hasOwn(executionMessages, message) ? message : "실행 결과를 확인하지 못했습니다. 다시 시도하기 전에 계정과 거래 상태를 확인하세요.";
  return executionMessages[message] ?? "The action could not be confirmed. Check account and transaction status before trying again.";
}

export function TaskExecution({ task, stopped, isStopped, onTask }: { task: TaskView; stopped: boolean; isStopped: () => boolean; onTask: (t: TaskView) => void }) {
  const wallet = useWallet(), owner = wallet.auth.session?.identity.address ?? "";
  const { locale, t } = useLocale();
  const scopeKey = `${owner.toLowerCase()}:${task.taskId}`;
  const [accountState, setAccount] = useState<TaskAccount | null>(null), [funding, setFunding] = useState<Funding | null>(null);
  const [pendingState, setPending] = useState<WalletOperation | null>(null), [busy, setBusy] = useState(false);
  const [serverUnknownState, setServerUnknown] = useState<ServerUnknown | null>(null);
  const [restoredScope, setRestoredScope] = useState("");
  const [storageValid, setStorageValid] = useState(false);
  const [restoration, setRestoration] = useState<"loading" | "unprepared" | "restored" | "failed">("loading");
  const account = restoredScope === scopeKey ? accountState : null;
  const pending = restoredScope === scopeKey ? pendingState : null;
  const serverUnknown = restoredScope === scopeKey ? serverUnknownState : null;
  const ready = restoredScope === scopeKey && (restoration === "unprepared" || restoration === "restored");
  const unknownRef = useRef<ServerUnknown | null>(null), pendingRef = useRef<WalletOperation | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [walletDiagnostic, setWalletDiagnostic] = useState<Pick<WalletRequestFailure, "phase" | "code" | "category"> | null>(null);
  const locked = useRef(false), alive = useRef(false), latest = useRef({ isStopped, owner, taskId: task.taskId });
  const onTaskRef = useRef(onTask), generationRef = useRef(0), hasRecoveryRef = useRef(false), storageValidRef = useRef(false), restoringRef = useRef<number | null>(null);
  const poll = useRef({ key: "", attempts: 0 });
  const reconcileRef = useRef<() => Promise<void>>(async () => {});
  const [visibilityEpoch, setVisibilityEpoch] = useState(0);
  useLayoutEffect(() => { latest.current = { isStopped, owner, taskId: task.taskId }; onTaskRef.current = onTask; }, [isStopped, owner, task.taskId, onTask]);
  useEffect(() => {
    const visible = () => { if (!document.hidden) setVisibilityEpoch(value => value + 1); };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, []);
  const storageKey = `floww-account-wallet:${owner.toLowerCase()}:${task.taskId}`;
  const unknownKey = `floww-account-server:${owner.toLowerCase()}:${task.taskId}`;
  const restoreReadOnly = useCallback(async (generation: number) => {
    if (restoringRef.current !== null || !storageValidRef.current || !owner || !task.taskId) return;
    const current = () => alive.current && generationRef.current === generation
      && latest.current.owner === owner && latest.current.taskId === task.taskId && !latest.current.isStopped();
    if (!current()) return;
    restoringRef.current = generation;
    setRestoration("loading"); setAccount(null); setFunding(null); setError("");
    try {
      const fresh = await tasks.get(task.taskId);
      if (!current()) return;
      let restored: TaskAccount | null = null;
      try {
        restored = validateAccount(await accountApi.get(task.taskId), fresh, owner);
      } catch (cause) {
        const unprepared = cause instanceof Error && /^CHAIN_NOT_READY(?: ·|$)/.test(cause.message)
          && fresh.status === "AWAITING_APPROVAL" && fresh.attempts.some(attempt =>
            attempt.policy.decision === "ALLOW" && attempt.mandateId === fresh.mandate.mandateId
            && attempt.mandateVersion === fresh.mandate.version)
          && !hasRecoveryRef.current && !pendingRef.current && !unknownRef.current;
        if (!unprepared) throw cause;
      }
      if (!current()) return;
      setAccount(restored); setFunding(null);
      if (restored && unknownRef.current && restored.state !== unknownRef.current.fromState) {
        sessionStorage.removeItem(unknownKey); unknownRef.current = null; setServerUnknown(null);
      }
      const savedPending = pendingRef.current;
      if (restored && savedPending?.kind === "deploy" && savedPending.hash
        && restored.deployTxHash?.toLowerCase() === savedPending.hash.toLowerCase() && restored.state !== "PREPARED") {
        sessionStorage.removeItem(storageKey); pendingRef.current = null; setPending(null);
      }
      onTaskRef.current(fresh);
      setRestoration(restored ? "restored" : "unprepared");
    } catch (cause) {
      if (current()) { setRestoration("failed"); setError(cause instanceof Error ? cause.message : "요청 결과를 확인하지 못했습니다."); }
    } finally { if (restoringRef.current === generation) restoringRef.current = null; }
  }, [owner, task.taskId, storageKey, unknownKey]);
  useEffect(() => {
    const generation = ++generationRef.current;
    alive.current = true; restoringRef.current = null; hasRecoveryRef.current = false; storageValidRef.current = false;
    queueMicrotask(() => { if (!alive.current || generationRef.current !== generation) return;
    setRestoredScope(scopeKey); setStorageValid(false); setRestoration("loading"); setAccount(null); setFunding(null); setError(""); setNotice(""); setWalletDiagnostic(null);
    try {
      unknownRef.current = null;
      pendingRef.current = null;
      setServerUnknown(null);
      setPending(null);
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const stored = JSON.parse(raw) as WalletOperation & { data?: string };
        const value: WalletOperation = stored.data && /^0x(?:[0-9a-f]{2})+$/i.test(stored.data)
          ? { kind: stored.kind, hash: stored.hash, confirmed: stored.confirmed, at: stored.at, ...(stored.to ? { to: stored.to } : {}), dataHash: keccak256(stored.data) }
          : stored;
        if (!["deploy","allowance","fund"].includes(value.kind) || (value.hash !== null && !/^0x[0-9a-f]{64}$/i.test(value.hash)) || typeof value.confirmed !== "boolean" || !/^0x[0-9a-f]{64}$/i.test(value.dataHash)) throw new Error();
        if (stored.data) sessionStorage.setItem(storageKey, JSON.stringify(value));
        pendingRef.current = value;
        setPending(value);
      }
      const savedUnknown = sessionStorage.getItem(unknownKey);
      if (savedUnknown) {
        const value = JSON.parse(savedUnknown) as ServerUnknown;
        if (!["approve", "payment", "fulfillment"].includes(value.action) || typeof value.fromState !== "string") throw new Error();
        unknownRef.current = value;
        setServerUnknown(value);
      }
      hasRecoveryRef.current = !!raw || !!savedUnknown;
      storageValidRef.current = true;
      setStorageValid(true);
      void restoreReadOnly(generation);
    } catch { setRestoration("failed"); setError("거래 복구 기록을 읽을 수 없습니다. 중복 지급 방지를 위해 지갑 실행을 잠갔습니다."); }
    });
    return () => { alive.current = false; if (generationRef.current === generation) generationRef.current = generation + 1; };
  }, [storageKey, unknownKey, scopeKey, restoreReadOnly]);
  function allowed() { return alive.current && !latest.current.isStopped() && latest.current.owner === owner && latest.current.taskId === task.taskId; }
  function ensure() { if (!allowed()) throw new Error("STOPPED 또는 지갑 세션 변경 · 후속 실행 금지"); }
  function save(value: WalletOperation | null) {
    // Storage must succeed BEFORE asking the wallet; failure locks execution.
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey);
    pendingRef.current = value;
    if (alive.current) setPending(value);
  }
  function saveUnknown(value: ServerUnknown | null) {
    if (value) sessionStorage.setItem(unknownKey, JSON.stringify(value)); else sessionStorage.removeItem(unknownKey);
    unknownRef.current = value;
    if (alive.current) setServerUnknown(value);
  }
  async function run(job: () => Promise<void>) {
    if (locked.current || !ready || !allowed()) return;
    locked.current = true; setBusy(true); setError(""); setNotice(""); setWalletDiagnostic(null);
    try { await job(); } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "요청 결과를 확인하지 못했습니다."); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function refresh() {
    const t = await tasks.get(task.taskId); ensure();
    const a = validateAccount(await accountApi.get(task.taskId), t, owner); ensure();
    onTaskRef.current(t); setAccount(a); setFunding(null);
    if (unknownRef.current && a.state !== unknownRef.current.fromState) saveUnknown(null);
    if (pendingRef.current?.kind === "deploy" && pendingRef.current.hash && a.deployTxHash?.toLowerCase() === pendingRef.current.hash.toLowerCase() && a.state !== "PREPARED") save(null);
    return {t,a};
  }
  async function live() { const result = await refresh(); assertLive(result.t,result.a); return result; }
  async function submitServer(action: ServerUnknown["action"], fromState: string) {
    ensure();
    if (unknownRef.current) throw new Error("이전 서버 거래 결과를 먼저 확인하세요. 같은 요청을 다시 전송하지 않습니다.");
    saveUnknown({ action, fromState });
    await accountApi.action(task.taskId, action);
    ensure();
    await refresh();
  }
  useEffect(() => {
    reconcileRef.current = () => run(async () => { ensure(); await accountApi.action(task.taskId, "reconcile"); ensure(); await refresh(); });
  });
  const pollKey = account?.state.endsWith("_UNKNOWN")
    ? `${task.taskId}:${account.state}:${account.approvalTxHash ?? account.paymentTxHash ?? account.fulfillmentTxHash ?? ""}` : "";
  useEffect(() => {
    if (poll.current.key !== pollKey) poll.current = { key: pollKey, attempts: 0 };
    if (!pollKey || busy || stopped || !ready || document.hidden || poll.current.attempts >= 3) return;
    const timer = window.setTimeout(() => {
      if (locked.current || !alive.current || latest.current.isStopped() || document.hidden) return;
      poll.current.attempts++;
      void reconcileRef.current();
    }, [2000, 4000, 8000][poll.current.attempts]);
    return () => window.clearTimeout(timer);
  }, [pollKey, busy, stopped, ready, visibilityEpoch]);
  async function send(kind: WalletOperation["kind"], a: TaskAccount, data: string, to?: string) {
    ensure(); if (pending && !pending.confirmed) throw new Error("기존 지갑 요청 결과를 먼저 확인하세요.");
    const record: WalletOperation = {kind,hash:null,confirmed:false,at:new Date().toISOString(),dataHash:keccak256(data),...(to ? {to} : {})};
    save(record);
    try {
      const hash = await wallet.requestForOwner(a.ownerAddress,"eth_sendTransaction",[{from:a.ownerAddress,...(to ? {to} : {}),data,value:"0x0"}],allowed);
      if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("거래 결과 불명 · 자동 재전송하지 않습니다.");
      // Even if STOP was pressed during the popup, keep the broadcast evidence.
      save({...record,hash}); ensure(); setNotice("Sepolia 거래 제출됨 · 영수증 확인 전에는 성공으로 표시하지 않습니다.");
    } catch(e) {
      if (e && typeof e === "object" && "code" in e && e.code === 4001) { save(null); throw new Error("사용자가 지갑 요청을 거절했습니다. 거래를 제출하지 않았습니다."); }
      if (e instanceof WalletRequestFailure) {
        if (alive.current) setWalletDiagnostic({ phase: e.phase, code: e.code, category: e.category });
        throw new Error("지갑 요청 결과를 확인하지 못했습니다. 거래 상태를 확인하기 전에는 재전송하지 마세요.");
      }
      throw e;
    }
  }
  async function receipt() {
    if (!pending?.hash) throw new Error("거래 해시를 받지 못했습니다. 지갑 활동에서 확인하기 전에는 재전송할 수 없습니다.");
    const hash=pending.hash;
    const r = await wallet.requestForOwner(owner,"eth_getTransactionReceipt",[hash],allowed) as {status:string;contractAddress:string|null;transactionHash:string}|null;
    ensure(); if (!r) { setNotice("아직 채굴되지 않았습니다. 잠시 후 영수증을 다시 확인하세요."); return; }
    if (r.transactionHash?.toLowerCase() !== hash.toLowerCase()) throw new Error("영수증 해시 불일치");
    if (r.status === "0x0") { save(null); throw new Error("Sepolia 거래 실패 · 가스는 소모될 수 있습니다. 상태를 다시 조회하세요."); }
    if (r.status !== "0x1") throw new Error("알 수 없는 영수증 상태");
    const tx = await wallet.requestForOwner(owner,"eth_getTransactionByHash",[hash],allowed) as {from:string;to:string|null;input:string;value:string}|null;
    ensure();
    if (!tx || tx.from.toLowerCase() !== owner.toLowerCase() || (tx.to?.toLowerCase() ?? null) !== (pending.to?.toLowerCase() ?? null) || keccak256(tx.input) !== pending.dataHash || BigInt(tx.value) !== BigInt(0)) throw new Error("확인된 거래가 요청한 내용과 다릅니다.");
    if (pending.kind === "deploy") {
      const {a}=await live(); checkedDeployment(a);
      if (!r.contractAddress || !/^0x[0-9a-f]{40}$/i.test(r.contractAddress)) throw new Error("배포 주소 없음");
      ensure(); await accountApi.action(task.taskId,"bind",{accountAddress:r.contractAddress,deploymentTxHash:hash});
      ensure(); save(null); await refresh();
    } else {
      save({...pending,confirmed:true}); await refresh();
      setNotice(pending.kind === "allowance" ? "토큰 허용 영수증 확인 · 충전은 별도 요청입니다." : "충전 영수증 확인 · 서버 잔액을 조회한 뒤 주문을 진행하세요.");
    }
  }
  const eligible = task.attempts.find(a => a.policy.decision === "ALLOW" && a.mandateId === task.mandate.mandateId && a.mandateVersion === task.mandate.version);
  const terminal = !["AWAITING_APPROVAL","ACTIVE","EXECUTING"].includes(task.status);
  const disabled = busy || stopped || !ready;
  const serverBlocked = disabled || !!serverUnknown;
  const progress = account ? accountProgress(account,task.status) : null;
  const hasOrder = account && task.attempts.find(a=>a.attemptId===account.attemptId)?.order;
  const selectedAttempt = account && task.attempts.find(a => a.attemptId === account.attemptId);
  return <section aria-label={t("실제 Sepolia 구매 실행", "Sepolia purchase execution")} className="approval-proposal">
    <div className="section-heading"><h3>{t('선택한 구매 진행', 'Selected purchase progress')}</h3><span className="tag">{stopped ? t("진행 중지", "Stopped") : progress?.completed ? t("이행 확인됨", "Fulfillment verified") : progress?.paid ? t("지급 확인됨", "Payment verified") : account?.state === "PREPARED" ? t("지갑 배포 대기", "Awaiting wallet deployment") : account?.state?.endsWith("_UNKNOWN") ? t("거래 확인 중", "Checking transaction") : t("승인 준비", "Preparing approval")}</span></div>
    <p className="form-note">{t('구매 조건을 확인한 뒤 지갑의 각 승인 요청을 직접 확인해 주세요.', 'Review purchase conditions, then confirm each wallet approval request yourself.')}</p><details className="studio-details"><summary>{t('거래 환경과 이행 범위', 'Transaction environment and fulfillment scope')}</summary><p>{t('Sepolia의 테스트 토큰으로 거래합니다. 약국 이행 응답은 검증용 판매자 서비스에서 제공하며 실제 의약품 배송을 의미하지 않습니다.', 'Transactions use test tokens on Sepolia. Pharmacy fulfillment responses come from a verification service and do not mean real medicine was delivered.')}</p></details>
    {!wallet.connection && <Link className="text-link" href="/login">{t('서명할 지갑 연결 확인 ↗', 'Check signing wallet connection ↗')}</Link>}
    {restoredScope === scopeKey && restoration === "loading" && <p role="status">{t('현재 작업과 계정 상태를 확인하고 있습니다. 확인 전에는 후속 실행을 진행하지 않습니다.', 'Checking the current Task and account status. Further actions are paused until the check completes.')}</p>}
    {restoredScope === scopeKey && restoration === "unprepared" && <p role="status">{t('현재 작업에 연결된 계정을 확인하지 못했습니다. 새 계정을 준비하기 전에 체인 연결 상태도 확인하세요.', 'No account was returned for this Task. Check chain availability before preparing an account.')}</p>}
    {restoredScope === scopeKey && restoration === "failed" && <p role="alert">{t('현재 계정 상태를 확인하지 못했습니다. 후속 실행은 잠겨 있습니다. 상태 조회를 다시 시도하세요.', 'The current account status could not be confirmed. Further actions are locked. Retry the status check.')}</p>}
    <div className="api-actions">
      {!account && restoration === "unprepared" && <button className="button primary" disabled={disabled || terminal || !eligible || !wallet.connection} onClick={()=>void run(async()=>{
        const t=await tasks.get(task.taskId); ensure();
        const attempt=t.attempts.find(a=>a.attemptId===eligible?.attemptId && a.policy.decision==="ALLOW" && a.mandateVersion===t.mandate.version);
        if (!attempt || t.status!=="AWAITING_APPROVAL") throw new Error("정책 통과 및 최신 Mandate를 다시 확인하세요.");
        const a=validateAccount(await accountApi.action(t.taskId,"prepare",{attemptId:attempt.attemptId,ownerAddress:owner}),t,owner); ensure();
        assertLive(t,a); onTask(t); setAccount(a);
      })}>{t('Mandate 확인 및 위임 승인 준비', 'Review mandate and prepare delegation approval')}</button>}
      <button className="button secondary" disabled={busy || stopped || restoredScope !== scopeKey || restoration === "loading" || !storageValid} onClick={()=>void restoreReadOnly(generationRef.current)}>{restoration === "failed" ? t('계정·거래 상태 다시 조회', 'Retry account and transaction status') : t('계정·거래 상태 조회', 'Check account and transaction status')}</button>
    </div>
    {account && <>
      <dl className="purchase-details"><div><dt>{t('구매 목적', 'Purchase goal')}</dt><dd>{locale === "en" && task.goal === "이미 처방받은 의약품 1팩 구매" ? "Buy one pack of previously prescribed medicine" : task.goal}</dd></div><div><dt>{t('선택 약국', 'Selected pharmacy')}</dt><dd>{selectedAttempt ? merchantLabel(selectedAttempt.merchantId, locale) : t("확인 중", "Checking")}</dd></div><div><dt>{t('이번 구매 금액', 'Purchase amount')}</dt><dd>{formatFusdc(account.amountBaseUnits)}</dd></div><div><dt>{t('작업 지출 한도', 'Task spending limit')}</dt><dd>{formatFusdc(task.mandate.maxAmountBaseUnits)}</dd></div><div><dt>{t('승인 기한', 'Approval deadline')}</dt><dd>{new Date(account.expiresAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}</dd></div></dl>
      <details><summary>{t('거래 근거와 주소', 'Transaction basis and addresses')}</summary><dl className="purchase-details"><div><dt>{t('견적 ID', 'Quote ID')}</dt><dd>{selectedAttempt?.quoteId}</dd></div><div><dt>{t('수취인 주소', 'Recipient address')}</dt><dd>{account.recipientAddress}</dd></div><div><dt>Task Account</dt><dd>{account.accountAddress ?? t("지갑 배포 전", "Before wallet deployment")}</dd></div><div><dt>{t('검토 스냅샷', 'Review snapshot')}</dt><dd>{account.reviewSnapshotDigest}</dd></div></dl></details>
      <div className="api-actions">
        {account.state==="PREPARED" && !pending && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{ const {a}=await live(); await send("deploy",a,checkedDeployment(a)); })}>{t('지갑에서 Task Account 배포 · 가스 필요', 'Deploy Task Account in wallet · gas required')}</button>}
        {account.state==="BOUND" && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{
          const {a}=await live(); const r=await accountApi.action(task.taskId,"approval-request") as Approval; ensure();
          const d=checkedApproval(a,r); const sig=await wallet.requestForOwner(owner,"eth_signTypedData_v4",[owner,JSON.stringify(d)],allowed); ensure();
          checkSignature(a,r,sig); const current=await live();
          if (current.a.reviewSnapshotDigest!==a.reviewSnapshotDigest || current.a.accountAddress!==a.accountAddress) throw new Error("승인 버전 변경");
          ensure(); await accountApi.action(task.taskId,"signature",{signature:sig}); ensure(); await refresh();
        })}>{t('Mandate 확인 및 위임 승인 · EIP-712 서명', 'Review mandate and approve delegation · EIP-712 signature')}</button>}
        {account.state==="SIGNED" && <button className="button primary" disabled={serverBlocked || terminal} onClick={()=>void run(async()=>{await live(); await submitServer("approve", "SIGNED");})}>{t('검증된 위임을 Sepolia에 등록', 'Register verified delegation on Sepolia')}</button>}
        {account.state.endsWith("_UNKNOWN") && <button className="button primary" disabled={disabled} onClick={()=>void run(async()=>{ensure(); await accountApi.action(task.taskId,"reconcile"); ensure(); await refresh();})}>{t('제출된 거래 영수증 재확인 · 재전송 없음', 'Recheck submitted transaction receipt · no resubmission')}</button>}
        {account.state==="APPROVED" && <>
          <button className="button secondary" disabled={disabled || terminal} onClick={()=>void run(async()=>{const {a}=await live(); const f=checkedFunding(a,await accountApi.funding(task.taskId)); ensure();setFunding(f);})}>{t('서버 충전 잔액 조회', 'Check server funding balance')}</button>
          {funding && BigInt(funding.accountTokenBalanceBaseUnits)<BigInt(account.amountBaseUnits) && <>
            <p>{t("확인된 계정 잔액:", "Verified account balance:")} {formatFusdc(funding.accountTokenBalanceBaseUnits)} · {t("필요한 충전:", "Required funding:")} {formatFusdc(account.amountBaseUnits)}</p>
            {!pending && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{const {a}=await live();const f=checkedFunding(a,await accountApi.funding(task.taskId));ensure();if(BigInt(f.accountTokenBalanceBaseUnits)>=BigInt(a.amountBaseUnits))throw new Error("이미 충전된 계정입니다.");await send("allowance",a,f.tokenApproveData,a.tokenAddress);})}>{t('선택 금액만 토큰 사용 허용', 'Allow token use for selected amount only')}</button>}
            {pending?.kind==="allowance" && pending.confirmed && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{const {a}=await live();const f=checkedFunding(a,await accountApi.funding(task.taskId));ensure();if(BigInt(f.accountTokenBalanceBaseUnits)>=BigInt(a.amountBaseUnits))throw new Error("이미 충전된 계정입니다.");await send("fund",a,f.accountFundData,a.accountAddress!);})}>{t("구매 계정 충전", "Fund purchase account")} · {formatFusdc(account.amountBaseUnits)}</button>}
          </>}
          {funding && BigInt(funding.accountTokenBalanceBaseUnits)>=BigInt(account.amountBaseUnits) && <button className="button primary" disabled={serverBlocked || terminal} onClick={()=>void run(async()=>{
            const {a,t}=await live(); const f=checkedFunding(a,await accountApi.funding(task.taskId)); ensure();
            if(BigInt(f.accountTokenBalanceBaseUnits)<BigInt(a.amountBaseUnits))throw new Error("충전 잔액 부족");
            if(!t.attempts.find(x=>x.attemptId===a.attemptId)?.order) {await accountApi.order(task.taskId,a.attemptId,`floww-order-${a.attemptId}`);ensure();await refresh();setNotice("서버 주문 생성됨 · 실제 지급은 다음 버튼으로 요청하세요.");}
            else {await submitServer("payment", "APPROVED");}
          })}>{hasOrder ? t("승인된 주문 Sepolia 지급 요청", "Request Sepolia payment for approved order") : t("선택한 약국에 주문", "Place order with selected pharmacy")}</button>}
        </>}
        {account.state==="PAID" && <button className="button primary" disabled={serverBlocked || terminal} onClick={()=>void run(async()=>{const {a,t}=await refresh();ensure();if(a.state!=="PAID" || t.status!=="EXECUTING")throw new Error("서버 지급 상태를 확인하세요.");await submitServer("fulfillment", "PAID");})}>{t('약국 이행 확인', 'Check pharmacy fulfillment')}</button>}
      </div>
      <p role="status">{progress?.completed ? t("지급과 약국 이행 확인을 마쳤습니다.", "Payment and pharmacy fulfillment have been verified.") : progress?.paid ? t("지급 검증 완료 · 이행 검증 전에는 구매 완료가 아닙니다.", "Payment verified. The purchase is not complete until fulfillment is verified.") : t("결제 완료 전 · 서버 검증 상태를 기다리고 있습니다.", "Payment is not complete. Waiting for server verification.")}</p>
    </>}
    {pending && <div className="state-panel"><p>{({ deploy: t("배포", "Deployment"), allowance: t("토큰 사용 허용", "Token allowance"), fund: t("충전", "Funding") })[pending.kind]} · {pending.confirmed ? t("영수증 확인됨", "Receipt verified") : t("지갑 요청 확인 대기", "Awaiting wallet response")}</p>{pending.hash ? <><a className="text-link" href={`https://sepolia.etherscan.io/tx/${pending.hash}`} target="_blank" rel="noreferrer">{t('Sepolia 거래 확인 ↗', 'View Sepolia transaction ↗')}</a>{!pending.confirmed && <button className="button secondary" disabled={disabled} onClick={()=>void run(receipt)}>{t('지갑 거래 영수증 확인', 'Check wallet transaction receipt')}</button>}</> : <><p>{t('응답을 받기 전까지 재전송을 차단합니다. 지갑 활동에서 해당 거래 해시를 찾으면 영수증을 검증하여 복구할 수 있습니다.', 'Resubmission is blocked until a response is received. If you find the transaction hash in wallet activity, verify its receipt to recover.')}</p><form onSubmit={event=>{event.preventDefault();const hash=String(new FormData(event.currentTarget).get("hash"));void run(async()=>{if(!/^0x[0-9a-f]{64}$/i.test(hash))throw new Error("올바른 거래 해시를 입력하세요.");save({...pending,hash});});}}><label className="field">{t('지갑에서 확인한 거래 해시', 'Transaction hash found in wallet')}<input name="hash" required pattern="0x[0-9a-fA-F]{64}" /></label><button className="button secondary" disabled={disabled}>{t('해시로 복구 · 재전송 없음', 'Recover by hash · no resubmission')}</button></form></>}</div>}
    {busy && <p role="status">{t('처리 중 · 중복 클릭과 자동 재시도 차단', 'Processing · duplicate clicks and automatic retries blocked')}</p>}{notice && <p role="status">{localizedExecutionMessage(notice, locale)}</p>}{error && <><p role="alert">{localizedExecutionMessage(error, locale)}</p>{walletDiagnostic && <details className="studio-details"><summary>{t("지갑 요청 진단", "Wallet request diagnostic")}</summary><dl><div><dt>{t("단계", "Phase")}</dt><dd>{({ account: t("지갑 계정 확인", "Wallet account check"), chain: t("지갑 네트워크 확인", "Wallet network check"), operation: t("지갑 거래 요청", "Wallet transaction request") })[walletDiagnostic.phase]}</dd></div><div><dt>{t("분류", "Category")}</dt><dd><code>{walletDiagnostic.category}</code></dd></div><div><dt>{t("제공자 코드", "Provider code")}</dt><dd><code>{walletDiagnostic.code ?? t("없음", "Unavailable")}</code></dd></div></dl></details>}{executionCode(error) && <details className="studio-details"><summary>{t("진단 코드", "Diagnostic code")}</summary><code>{executionCode(error)}</code></details>}</>}
    {serverUnknown && <p role="alert">{t('서버 거래 결과를 확인하지 못했습니다. 같은 승인·지급 요청을 다시 보내지 않습니다. 계정·거래 상태를 조회하고, 제출된 거래가 있다면 영수증을 재확인하세요.', 'Server transaction result could not be confirmed. Do not resend the same approval or payment. Check account and transaction status, and recheck any submitted transaction receipt.')}</p>}
    {stopped && <p role="alert">{t('STOPPED · 승인·충전·지급·후속 실행 금지. 열려 있는 지갑 요청은 지갑에서 직접 거절하세요. 이미 제출된 거래는 취소되지 않습니다. 서버 취소와 온체인 권한 철회는 별도 확인이 필요합니다.', 'STOPPED · Approval, funding, payment, and further actions are blocked. Reject any open wallet request in your wallet. Submitted transactions cannot be cancelled here. Server cancellation and onchain revocation need separate verification.')}</p>}
  </section>;
}
