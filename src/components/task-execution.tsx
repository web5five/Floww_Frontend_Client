"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "./wallet-provider";
import { tasks } from "@/lib/api/task-client";
import { accountApi, assertLive, checkedApproval, checkedDeployment, checkedFunding, checkSignature, validateAccount, type Approval, type Funding, type TaskAccount } from "@/lib/api/task-account";
import type { TaskView } from "@/lib/api/task-types";
import { formatFusdc } from "@/lib/pharmacy-preview";
import { accountProgress } from "@/lib/api/account-evidence";

type WalletOperation = { kind: "deploy" | "allowance" | "fund"; hash: string | null; confirmed: boolean; at: string; to?: string; data: string };
export function TaskExecution({ task, stopped, isStopped, onTask }: { task: TaskView; stopped: boolean; isStopped: () => boolean; onTask: (t: TaskView) => void }) {
  const wallet = useWallet(), owner = wallet.auth.session?.identity.address ?? "";
  const [account, setAccount] = useState<TaskAccount | null>(null), [funding, setFunding] = useState<Funding | null>(null);
  const [pending, setPending] = useState<WalletOperation | null>(null), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const locked = useRef(false), alive = useRef(true), latest = useRef({ isStopped, owner });
  useEffect(() => { latest.current = { isStopped, owner }; }, [isStopped, owner]);
  const storageKey = `floww-account-wallet:${owner.toLowerCase()}:${task.taskId}`;
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => { if (!alive.current) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const value = JSON.parse(raw) as WalletOperation;
        if (!["deploy","allowance","fund"].includes(value.kind) || (value.hash !== null && !/^0x[0-9a-f]{64}$/i.test(value.hash)) || typeof value.confirmed !== "boolean" || !/^0x[0-9a-f]+$/i.test(value.data)) throw new Error();
        setPending(value);
      }
      setReady(true);
    } catch { setError("거래 복구 기록을 읽을 수 없습니다. 중복 지급 방지를 위해 지갑 실행을 잠갔습니다."); }
    });
    return () => { alive.current = false; };
  }, [storageKey]);
  function allowed() { return alive.current && !latest.current.isStopped() && latest.current.owner === owner; }
  function ensure() { if (!allowed()) throw new Error("STOPPED 또는 지갑 세션 변경 · 후속 실행 금지"); }
  function save(value: WalletOperation | null) {
    // Storage must succeed BEFORE asking the wallet; failure locks execution.
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey);
    if (alive.current) setPending(value);
  }
  async function run(job: () => Promise<void>) {
    if (locked.current || !ready || !allowed()) return;
    locked.current = true; setBusy(true); setError(""); setNotice("");
    try { await job(); } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "요청 결과를 확인하지 못했습니다."); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function refresh() {
    const t = await tasks.get(task.taskId); ensure();
    const a = validateAccount(await accountApi.get(task.taskId), t, owner); ensure();
    onTask(t); setAccount(a); setFunding(null);
    if (pending?.kind === "deploy" && pending.hash && a.deployTxHash?.toLowerCase() === pending.hash.toLowerCase() && a.state !== "PREPARED") save(null);
    return {t,a};
  }
  async function live() { const result = await refresh(); assertLive(result.t,result.a); return result; }
  async function send(kind: WalletOperation["kind"], a: TaskAccount, data: string, to?: string) {
    ensure(); if (pending && !pending.confirmed) throw new Error("기존 지갑 요청 결과를 먼저 확인하세요.");
    const record: WalletOperation = {kind,hash:null,confirmed:false,at:new Date().toISOString(),data,...(to ? {to} : {})};
    save(record);
    try {
      const hash = await wallet.requestForOwner(a.ownerAddress,"eth_sendTransaction",[{from:a.ownerAddress,...(to ? {to} : {}),data,value:"0x0"}],allowed);
      if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("거래 결과 불명 · 자동 재전송하지 않습니다.");
      // Even if STOP was pressed during the popup, keep the broadcast evidence.
      save({...record,hash}); ensure(); setNotice("Sepolia 거래 제출됨 · 영수증 확인 전에는 성공으로 표시하지 않습니다.");
    } catch(e) {
      if (e && typeof e === "object" && "code" in e && e.code === 4001) { save(null); throw new Error("사용자가 지갑 요청을 거절했습니다. 거래를 제출하지 않았습니다."); }
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
    if (!tx || tx.from.toLowerCase() !== owner.toLowerCase() || (tx.to?.toLowerCase() ?? null) !== (pending.to?.toLowerCase() ?? null) || tx.input.toLowerCase() !== pending.data.toLowerCase() || BigInt(tx.value) !== BigInt(0)) throw new Error("확인된 거래가 요청한 내용과 다릅니다.");
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
  const progress = account ? accountProgress(account,task.status) : null;
  const hasOrder = account && task.attempts.find(a=>a.attemptId===account.attemptId)?.order;
  return <section aria-label="실제 Sepolia 구매 실행" className="approval-proposal">
    <div className="section-heading"><h3>승인에서 수령 확인까지</h3><span className="tag">{stopped ? "STOPPED" : account?.state ?? "승인 준비"}</span></div>
    <p className="form-note">실제 Sepolia 테스트 거래입니다. 지갑 로그인과 지출 승인은 별개이며, 각 지갑 요청 내용을 확인해야 합니다. 약국 이행은 시뮬레이션입니다.</p>
    {!wallet.connection && <Link className="text-link" href="/login">서명할 지갑 연결 확인 ↗</Link>}
    <div className="api-actions">
      {!account && <button className="button primary" disabled={disabled || terminal || !eligible || !wallet.connection} onClick={()=>void run(async()=>{
        const t=await tasks.get(task.taskId); ensure();
        const attempt=t.attempts.find(a=>a.attemptId===eligible?.attemptId && a.policy.decision==="ALLOW" && a.mandateVersion===t.mandate.version);
        if (!attempt || t.status!=="AWAITING_APPROVAL") throw new Error("정책 통과 및 최신 Mandate를 다시 확인하세요.");
        const a=validateAccount(await accountApi.action(t.taskId,"prepare",{attemptId:attempt.attemptId,ownerAddress:owner}),t,owner); ensure();
        assertLive(t,a); onTask(t); setAccount(a);
      })}>Mandate 확인 및 위임 승인 준비</button>}
      <button className="button secondary" disabled={disabled} onClick={()=>void run(async()=>{await refresh();})}>계정·거래 상태 조회</button>
    </div>
    {account && <>
      <dl className="purchase-details"><div><dt>선택 견적 / 지급 상한</dt><dd>{task.attempts.find(a=>a.attemptId===account.attemptId)?.quoteId} · {formatFusdc(account.amountBaseUnits)}</dd></div><div><dt>수취인</dt><dd>{account.recipientAddress}</dd></div><div><dt>Task Account</dt><dd>{account.accountAddress ?? "지갑 배포 전"}</dd></div><div><dt>승인 기한</dt><dd>{new Date(account.expiresAt).toLocaleString("ko-KR")}</dd></div></dl>
      <div className="api-actions">
        {account.state==="PREPARED" && !pending && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{ const {a}=await live(); await send("deploy",a,checkedDeployment(a)); })}>지갑에서 Task Account 배포 · 가스 필요</button>}
        {account.state==="BOUND" && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{
          const {a}=await live(); const r=await accountApi.action(task.taskId,"approval-request") as Approval; ensure();
          const d=checkedApproval(a,r); const sig=await wallet.requestForOwner(owner,"eth_signTypedData_v4",[owner,JSON.stringify(d)],allowed); ensure();
          checkSignature(a,r,sig); const current=await live();
          if (current.a.reviewSnapshotDigest!==a.reviewSnapshotDigest || current.a.accountAddress!==a.accountAddress) throw new Error("승인 버전 변경");
          ensure(); await accountApi.action(task.taskId,"signature",{signature:sig}); ensure(); await refresh();
        })}>Mandate 확인 및 위임 승인 · EIP-712 서명</button>}
        {account.state==="SIGNED" && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{await live(); ensure(); await accountApi.action(task.taskId,"approve"); ensure(); await refresh();})}>검증된 위임을 Sepolia에 등록</button>}
        {account.state.endsWith("_UNKNOWN") && <button className="button primary" disabled={disabled} onClick={()=>void run(async()=>{ensure(); await accountApi.action(task.taskId,"reconcile"); ensure(); await refresh();})}>제출된 거래 영수증 재확인 · 재전송 없음</button>}
        {account.state==="APPROVED" && <>
          <button className="button secondary" disabled={disabled || terminal} onClick={()=>void run(async()=>{const {a}=await live(); const f=checkedFunding(a,await accountApi.funding(task.taskId)); ensure();setFunding(f);})}>서버 충전 잔액 조회</button>
          {funding && BigInt(funding.accountTokenBalanceBaseUnits)<BigInt(account.amountBaseUnits) && <>
            <p>확인된 계정 잔액: {formatFusdc(funding.accountTokenBalanceBaseUnits)} · 필요한 충전: {formatFusdc(account.amountBaseUnits)}</p>
            {!pending && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{const {a}=await live();const f=checkedFunding(a,await accountApi.funding(task.taskId));ensure();if(BigInt(f.accountTokenBalanceBaseUnits)>=BigInt(a.amountBaseUnits))throw new Error("이미 충전된 계정입니다.");await send("allowance",a,f.tokenApproveData,a.tokenAddress);})}>선택 금액만 토큰 사용 허용</button>}
            {pending?.kind==="allowance" && pending.confirmed && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{const {a}=await live();const f=checkedFunding(a,await accountApi.funding(task.taskId));ensure();if(BigInt(f.accountTokenBalanceBaseUnits)>=BigInt(a.amountBaseUnits))throw new Error("이미 충전된 계정입니다.");await send("fund",a,f.accountFundData,a.accountAddress!);})}>Task Account 충전 · {formatFusdc(account.amountBaseUnits)}</button>}
          </>}
          {funding && BigInt(funding.accountTokenBalanceBaseUnits)>=BigInt(account.amountBaseUnits) && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{
            const {a,t}=await live(); const f=checkedFunding(a,await accountApi.funding(task.taskId)); ensure();
            if(BigInt(f.accountTokenBalanceBaseUnits)<BigInt(a.amountBaseUnits))throw new Error("충전 잔액 부족");
            if(!t.attempts.find(x=>x.attemptId===a.attemptId)?.order) {await accountApi.order(task.taskId,a.attemptId,`floww-order-${a.attemptId}`);ensure();await refresh();setNotice("서버 주문 생성됨 · 실제 지급은 다음 버튼으로 요청하세요.");}
            else {ensure();await accountApi.action(task.taskId,"payment");ensure();await refresh();}
          })}>{hasOrder ? "승인된 주문 Sepolia 지급 요청" : "시뮬레이터 주문 생성"}</button>}
        </>}
        {account.state==="PAID" && <button className="button primary" disabled={disabled || terminal} onClick={()=>void run(async()=>{const {a,t}=await refresh();ensure();if(a.state!=="PAID" || t.status!=="EXECUTING")throw new Error("서버 지급 상태를 확인하세요.");await accountApi.action(task.taskId,"fulfillment");ensure();await refresh();})}>시뮬레이션 수령 확인 요청</button>}
      </div>
      <p role="status">{progress?.completed ? "Task COMPLETED · 지급 영수증 및 시뮬레이션 이행 검증 완료" : progress?.paid ? "지급 검증 완료 · 이행 검증 전에는 구매 완료가 아닙니다." : "결제 완료 전 · 서버 검증 상태를 기다리고 있습니다."}</p>
    </>}
    {pending && <div className="state-panel"><p>{pending.kind} · {pending.confirmed ? "영수증 확인됨" : "지갑 요청 확인 대기"}</p>{pending.hash ? <><a className="text-link" href={`https://sepolia.etherscan.io/tx/${pending.hash}`} target="_blank" rel="noreferrer">Sepolia 거래 확인 ↗</a>{!pending.confirmed && <button className="button secondary" disabled={disabled} onClick={()=>void run(receipt)}>지갑 거래 영수증 확인</button>}</> : <><p>응답을 받기 전까지 재전송을 차단합니다. 지갑 활동에서 해당 거래 해시를 찾으면 영수증을 검증하여 복구할 수 있습니다.</p><form onSubmit={event=>{event.preventDefault();const hash=String(new FormData(event.currentTarget).get("hash"));void run(async()=>{if(!/^0x[0-9a-f]{64}$/i.test(hash))throw new Error("올바른 거래 해시를 입력하세요.");save({...pending,hash});});}}><label className="field">지갑에서 확인한 거래 해시<input name="hash" required pattern="0x[0-9a-fA-F]{64}" /></label><button className="button secondary" disabled={disabled}>해시로 복구 · 재전송 없음</button></form></>}</div>}
    {busy && <p role="status">처리 중 · 중복 클릭과 자동 재시도 차단</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    {stopped && <p role="alert">STOPPED · 승인·충전·지급·후속 실행 금지. 이미 제출된 거래는 취소되지 않습니다. 서버 취소와 온체인 권한 철회는 별도 확인이 필요합니다.</p>}
  </section>;
}
