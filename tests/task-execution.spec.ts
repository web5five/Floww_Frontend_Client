import { test, expect, type Page } from "@playwright/test";
import { AbiCoder, Interface, TypedDataEncoder, Wallet, id } from "ethers";
import { accountAbi, checkedApproval, checkedDeployment, checkedFunding, checkSignature, reviewDigest, validateAccount, type TaskAccount, type Approval } from "../src/lib/api/task-account";
import artifact from "../src/lib/api/task-account-artifact.json";
import type { TaskView } from "../src/lib/api/task-types";

const taskId="11111111-2222-4333-8444-555555555555", mandateId="66666666-7777-4888-8999-aaaaaaaaaaaa", attemptId="bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const addr=(n:string)=>`0x${n.repeat(40)}`, hash=(n:string)=>`0x${n.repeat(64)}`;
function fixture(owner: string) {
  const expiry=new Date(Math.floor(Date.now()/1000)*1000+3600000).toISOString();
  const task: TaskView={taskId,status:"AWAITING_APPROVAL",statusReasonCode:null,goal:"fixture",mandate:{mandateId,version:3,status:"DRAFT",itemId:"acetaminophen-500mg-10",maxAmountBaseUnits:"60000000",remainingBaseUnits:"60000000",consumedBaseUnits:"0",asset:{chainId:11155111,tokenAddress:addr("2"),tokenDecimals:6},expiresAt:expiry,budgetScope:"TASK_CUMULATIVE"},attempts:[{attemptId,mandateId,mandateVersion:3,quoteId:"qt_a_reference_20260930",merchantId:"pharmacy-a",status:"PROPOSED",amountBaseUnits:"23500000",recipientAddress:addr("3"),policy:{decision:"ALLOW",reasonCode:null,message:null},payment:{status:"NOT_ATTEMPTED",txHash:null},order:null}],updatedAt:new Date().toISOString(),completedAt:null};
  const a: TaskAccount={taskId,attemptId,state:"PREPARED",ownerAddress:owner,accountAddress:null,deployTxHash:null,chainTaskId:id(`floww:task:${taskId}`),reviewSnapshotDigest:reviewDigest(task,task.attempts[0],expiry),amountBaseUnits:"23500000",tokenAddress:addr("2"),recipientAddress:addr("3"),executorAddress:addr("4"),fulfillmentReporter:addr("5"),quoteExpiresAt:expiry,expiresAt:expiry,deploymentData:null,approvalDigest:null,approvalTxHash:null,approvalOperationState:null,paymentTxHash:null,paymentOperationState:null,paymentVerifiedAt:null,fulfillmentTxHash:null,fulfillmentOperationState:null,fulfillmentVerifiedAt:null,fulfillmentEvidenceMode:null};
  a.deploymentData=(artifact.bytecode.startsWith("0x")?artifact.bytecode:`0x${artifact.bytecode}`)+accountAbi.encodeDeploy([owner,[a.chainTaskId,a.reviewSnapshotDigest,a.tokenAddress,a.recipientAddress,a.executorAddress,a.fulfillmentReporter,a.amountBaseUnits,String(Math.floor(Date.parse(expiry)/1000))]]).slice(2);
  return {task,a};
}
function approval(a:TaskAccount): Approval {
  const fields=["owner:address","taskId:bytes32","reviewSnapshotDigest:bytes32","token:address","recipient:address","executor:address","fulfillmentReporter:address","maxSpend:uint256","expiresAt:uint64","nonce:uint256"].map(x=>{const[name,type]=x.split(":");return{name,type};});
  const domain={name:"FlowwTaskAccount",version:"1",chainId:11155111,verifyingContract:a.accountAddress!};
  const message={owner:a.ownerAddress,taskId:a.chainTaskId,reviewSnapshotDigest:a.reviewSnapshotDigest,token:a.tokenAddress,recipient:a.recipientAddress,executor:a.executorAddress,fulfillmentReporter:a.fulfillmentReporter,maxSpend:a.amountBaseUnits,expiresAt:String(Math.floor(Date.parse(a.expiresAt)/1000)),nonce:"0"};
  return {typedData:{domain,primaryType:"MandateApproval",types:{EIP712Domain:["name:string","version:string","chainId:uint256","verifyingContract:address"].map(x=>{const[name,type]=x.split(":");return{name,type};}),MandateApproval:fields},message},digest:TypedDataEncoder.hash(domain,{MandateApproval:fields},message),nonce:"0",expiresAt:a.expiresAt};
}
test("shared ReviewSnapshotV1 golden vector and every authorization boundary", async()=>{
  const w=Wallet.createRandom(), {task,a}=fixture(w.address);
  const golden=structuredClone(task);golden.mandate.asset.tokenAddress="0x1390c8745eb49069afd3b89393997e3fa14614f5";golden.attempts[0].recipientAddress="0x1234567890123456789012345678901234567890";
  expect(reviewDigest(golden,golden.attempts[0],new Date(1790712000*1000).toISOString())).toBe("0xec4d825949723205fc69f22c87699d674a0bbbbb7ac3cabd813beabac584915a");
  expect(validateAccount(a,task,w.address)).toBe(a);expect(checkedDeployment(a)).toBe(a.deploymentData);
  for(const change of [{recipientAddress:addr("9")},{amountBaseUnits:"23500001"},{ownerAddress:addr("9")},{tokenAddress:addr("9")},{reviewSnapshotDigest:hash("9")},{expiresAt:new Date(Date.parse(a.expiresAt)+1000).toISOString()}]) expect(()=>validateAccount({...a,...change},task,w.address)).toThrow();
  expect(()=>checkedDeployment({...a,deploymentData:"0x1234"})).toThrow();
  a.accountAddress=addr("6");a.state="BOUND";const r=approval(a);expect(checkedApproval(a,r)).toBe(r.typedData);
  for(const field of ["owner","recipient","token","executor","fulfillmentReporter","maxSpend","nonce","taskId","reviewSnapshotDigest","expiresAt"]) {const altered=structuredClone(r);altered.typedData.message[field]=field==="maxSpend"?"60000000":field==="nonce"?"1":"0";expect(()=>checkedApproval(a,altered)).toThrow();}
  const wrongChain=structuredClone(r);wrongChain.typedData.domain.chainId=1;expect(()=>checkedApproval(a,wrongChain)).toThrow();
  const sig=await w.signTypedData(r.typedData.domain,{MandateApproval:r.typedData.types.MandateApproval},r.typedData.message);expect(checkSignature(a,r,sig)).toBe(sig);
  const wrong=Wallet.createRandom();expect(()=>checkSignature(a,r,wrong.signingKey.sign(r.digest).serialized)).toThrow();
  const f={accountAddress:a.accountAddress,tokenAddress:a.tokenAddress,amountBaseUnits:a.amountBaseUnits,tokenApproveData:new Interface(["function approve(address,uint256)"]).encodeFunctionData("approve",[a.accountAddress,a.amountBaseUnits]),accountFundData:accountAbi.encodeFunctionData("fund",[a.amountBaseUnits]),accountTokenBalanceBaseUnits:"0",mandateApproved:true};
  expect(checkedFunding(a,f)).toBe(f);expect(()=>checkedFunding(a,{...f,tokenApproveData:new Interface(["function approve(address,uint256)"]).encodeFunctionData("approve",[a.accountAddress,(BigInt(1)<<BigInt(256))-BigInt(1)])})).toThrow();
  expect(AbiCoder.defaultAbiCoder().decode(["uint256"],`0x${f.accountFundData.slice(10)}`)[0].toString()).toBe("23500000");
});

async function setup(page:Page, mode: "normal"|"deny"|"stop"|"reject"="normal") {
  const w=Wallet.createRandom(), {task,a}=fixture(w.address), sends: Record<string,string>[]=[];const posts:string[]=[];
  let fundingBalance="0", waitSign: (()=>void)|undefined, accountPrepared=false;
  await page.exposeFunction("fixtureRpc",async(method:string,params:unknown[])=>{
    if(["eth_accounts","eth_requestAccounts"].includes(method))return[w.address];
    if(method==="eth_chainId")return"0xaa36a7";
    if(method==="eth_signTypedData_v4"){
      if(mode==="reject")return{rejected:true};
      if(mode==="stop")await new Promise<void>(resolve=>{waitSign=resolve;});
      const d=JSON.parse(params[1] as string);return w.signTypedData(d.domain,{MandateApproval:d.types.MandateApproval},d.message);
    }
    if(method==="eth_sendTransaction"){sends.push(params[0] as Record<string,string>);return hash(String(sends.length));}
    const i=Number((params[0] as string).slice(-1))-1,tx=sends[i];
    if(method==="eth_getTransactionReceipt"){if(i===2)fundingBalance=a.amountBaseUnits;return{status:"0x1",transactionHash:params[0],contractAddress:i===0?addr("6"):null};}
    if(method==="eth_getTransactionByHash")return{from:w.address,to:tx.to??null,input:tx.data,value:"0x0"};
    throw new Error(`Unexpected RPC: ${method}`);
  });
  await page.addInitScript(()=>{
    const provider={request:async({method,params=[]}:{method:string;params?:unknown[]})=>{const result=await(window as unknown as {fixtureRpc:(m:string,p:unknown[])=>Promise<unknown>}).fixtureRpc(method,params);if(result && typeof result==="object" && "rejected" in result)throw{code:4001};return result;},on:()=>{},removeListener:()=>{}};
    window.addEventListener("eip6963:requestProvider",()=>window.dispatchEvent(new CustomEvent("eip6963:announceProvider",{detail:{info:{uuid:"execution-fixture",name:"MetaMask"},provider}})));
  });
  await page.route("**/api/wallet-auth/*",r=>r.fulfill({json:r.request().url().endsWith("config")?{enabled:true,mode:"team-jwt",businessReady:true}:{identity:{namespace:"eip155",address:w.address},chainId:"11155111",expiresAt:new Date(Date.now()+3600000).toISOString()}}));
  if(mode==="deny")task.attempts[0].policy={decision:"DENY",reasonCode:"RECIPIENT_NOT_ALLOWED",message:null};
  await page.route("**/api/tasks**",async r=>{
    const path=new URL(r.request().url()).pathname;
    if(r.request().method()==="POST")posts.push(path);
    if(path==="/api/tasks")return r.fulfill({json:[task]});
    if(path.endsWith("/events"))return r.fulfill({json:{events:[],nextCursor:0,hasMore:false}});
    if(path.endsWith("/quotes"))return r.fulfill({json:{taskId,mandateVersion:3,quotes:[{quoteId:"qt-b",merchantId:"pharmacy-b",itemName:"fixture B",totalAmountBaseUnits:"64000000",asset:task.mandate.asset,expiresAt:task.mandate.expiresAt,evidenceMode:"fixture"},{quoteId:"qt-c",merchantId:"pharmacy-c",itemName:"fixture C",totalAmountBaseUnits:"19000000",asset:task.mandate.asset,expiresAt:task.mandate.expiresAt,evidenceMode:"fixture"}]}});
    if(path.endsWith("/attempts")){const b=r.request().postDataJSON();expect(b.proposedBy).toBe("USER");task.attempts[0].policy={decision:"DENY",reasonCode:b.quoteId==="qt-b"?"BUDGET_EXCEEDED":"RECIPIENT_NOT_ALLOWED",message:null};return r.fulfill({json:task.attempts[0]});}
    if(path.endsWith("/mandate/reject")||path.endsWith("/cancel")){task.status="CANCELLED";return r.fulfill({json:task});}
    if(path.endsWith("/orders")){task.attempts[0].order={orderId:taskId,status:"CREATED",paymentStatus:"PENDING"};task.status="EXECUTING";return r.fulfill({json:task.attempts[0].order});}
    if(path.includes("/account")){
      if(path.endsWith("/account") && r.request().method()==="GET" && !accountPrepared)return r.fulfill({status:409,json:{reasonCode:"CHAIN_NOT_READY"}});
      if(path.endsWith("/prepare"))accountPrepared=true;
      if(path.endsWith("/bind")){a.state="BOUND";a.accountAddress=addr("6");a.deployTxHash=hash("1");}
      if(path.endsWith("/approval-request"))return r.fulfill({json:approval(a)});
      if(path.endsWith("/signature")){checkSignature(a,approval(a),r.request().postDataJSON().signature);a.state="SIGNED";task.status="ACTIVE";}
      if(path.endsWith("/approve")){a.state="APPROVAL_UNKNOWN";a.approvalTxHash=hash("a");a.approvalOperationState="UNKNOWN";}
      if(path.endsWith("/payment")){a.state="PAYMENT_UNKNOWN";a.paymentTxHash=hash("b");a.paymentOperationState="UNKNOWN";}
      if(path.endsWith("/fulfillment")){a.state="FULFILLMENT_UNKNOWN";a.fulfillmentTxHash=hash("c");a.fulfillmentOperationState="UNKNOWN";}
      if(path.endsWith("/reconcile")){
        if(a.state==="APPROVAL_UNKNOWN"){a.state="APPROVED";a.approvalOperationState="VERIFIED";}
        else if(a.state==="PAYMENT_UNKNOWN"){a.state="PAID";a.paymentOperationState="VERIFIED";a.paymentVerifiedAt=new Date().toISOString();}
        else if(a.state==="FULFILLMENT_UNKNOWN"){a.state="COMPLETED";a.fulfillmentOperationState="VERIFIED";a.fulfillmentVerifiedAt=new Date().toISOString();a.fulfillmentEvidenceMode="local_pharmacy_simulator";task.status="COMPLETED";}
      }
      if(path.endsWith("/funding"))return r.fulfill({json:{accountAddress:a.accountAddress,tokenAddress:a.tokenAddress,amountBaseUnits:a.amountBaseUnits,tokenApproveData:new Interface(["function approve(address,uint256)"]).encodeFunctionData("approve",[a.accountAddress,a.amountBaseUnits]),accountFundData:accountAbi.encodeFunctionData("fund",[a.amountBaseUnits]),accountTokenBalanceBaseUnits:fundingBalance,mandateApproved:true}});
      return r.fulfill({json:a});
    }
    return r.fulfill({json:task});
  });
  await page.goto("/login");
  await page.getByRole("button",{name:"지갑 선택",exact:true}).click();
  await page.getByRole("button",{name:/MetaMask.*이 브라우저에서 감지됨/}).click();
  await page.getByRole("button",{name:"MetaMask 연결",exact:true}).click();
  await page.getByRole("link",{name:"내 작업",exact:true}).click();
  await page.getByText("내 작업 다시 열기",{exact:true}).click();
  await page.getByRole("button",{name:"내 작업 조회",exact:true}).click();
  await page.locator(`a[href="/chat/${taskId}"]`).click();
  return{task,a,sends,posts,release:()=>waitSign?.()};
}
test("actual client workflow uses verified approval, exact funding, payment and fulfillment (fixture only)",async({page})=>{
  const f=await setup(page),p=page.getByRole("region",{name:"실제 Sepolia 구매 실행"});
  await p.getByRole("button",{name:"Mandate 확인 및 위임 승인 준비",exact:true}).click();
  await p.getByRole("button",{name:/Task Account 배포/}).evaluate((b:HTMLButtonElement)=>{b.click();b.click();});
  await p.getByRole("button",{name:"지갑 거래 영수증 확인",exact:true}).click();
  await p.getByRole("button",{name:/EIP-712 서명/}).click();
  await p.getByRole("button",{name:"검증된 위임을 Sepolia에 등록",exact:true}).click();
  await p.getByRole("button",{name:/제출된 거래 영수증 재확인/}).click();
  await p.getByRole("button",{name:"서버 충전 잔액 조회",exact:true}).click();
  await p.getByRole("button",{name:"선택 금액만 토큰 사용 허용",exact:true}).click();
  await p.getByRole("button",{name:"지갑 거래 영수증 확인",exact:true}).click();
  await p.getByRole("button",{name:"서버 충전 잔액 조회",exact:true}).click();
  await p.getByRole("button",{name:/구매 계정 충전/}).click();
  await p.getByRole("button",{name:"지갑 거래 영수증 확인",exact:true}).click();
  await p.getByRole("button",{name:"서버 충전 잔액 조회",exact:true}).click();
  await p.getByRole("button",{name:"선택한 약국에 주문",exact:true}).click();
  await p.getByRole("button",{name:"서버 충전 잔액 조회",exact:true}).click();
  await p.getByRole("button",{name:"승인된 주문 Sepolia 지급 요청",exact:true}).click();
  await expect(p).not.toContainText("지급과 약국 이행 확인을 마쳤습니다.");
  await p.getByRole("button",{name:/제출된 거래 영수증 재확인/}).click();
  await expect(p).toContainText("이행 검증 전에는 구매 완료가 아닙니다");
  await p.getByRole("button",{name:"약국 이행 확인",exact:true}).click();
  await p.getByRole("button",{name:/제출된 거래 영수증 재확인/}).click();
  await expect(page.locator("#scenario-progress")).toContainText("서버가 구매와 이행 확인을 완료로 기록했어요");
  await page.getByText("구매 근거와 거래 기록",{exact:true}).click();
  await page.getByRole("button",{name:"서버 결제 증거 조회",exact:true}).click();
  await expect(page.getByRole("region",{name:"서버 결제 증거",exact:true})).toContainText("서버 결제·이행 검증 완료");
  expect(f.sends).toHaveLength(3);
  expect(f.posts.filter(x=>x.endsWith("/payment"))).toHaveLength(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator("#scenario-progress").screenshot({path:`artifacts/execution-completed-fixture-${test.info().project.name}.png`,caret:"initial",timeout:60000});
});
test("DENY prevents prepare, signing and broadcast",async({page})=>{
  const f=await setup(page,"deny"),p=page.getByRole("region",{name:"실제 Sepolia 구매 실행"});
  await expect(p).toHaveCount(0);
  expect(f.sends).toHaveLength(0);expect(f.posts).toHaveLength(0);
});
test("STOP during wallet approval forbids signature submission and execution",async({page})=>{
  const f=await setup(page,"stop"),p=page.getByRole("region",{name:"실제 Sepolia 구매 실행"});
  await p.getByRole("button",{name:"Mandate 확인 및 위임 승인 준비",exact:true}).click();
  await p.getByRole("button",{name:/Task Account 배포/}).click();await p.getByRole("button",{name:"지갑 거래 영수증 확인",exact:true}).click();
  await p.getByRole("button",{name:/EIP-712 서명/}).click();
  await expect.poll(()=>f.posts.some(x=>x.endsWith("/approval-request"))).toBe(true);
  await page.getByRole("button",{name:"작업 중단",exact:true}).click();f.release();
  await expect(p).toHaveCount(0); await expect(page.getByRole("alert").filter({hasText:"후속 실행이 잠겼습니다"})).toBeVisible();
  expect(f.posts.some(x=>/\/(signature|approve|payment)$/.test(x))).toBe(false);
});
test("wallet signature rejection never reaches authorization endpoint",async({page})=>{
  const f=await setup(page,"reject"),p=page.getByRole("region",{name:"실제 Sepolia 구매 실행"});
  await p.getByRole("button",{name:"Mandate 확인 및 위임 승인 준비",exact:true}).click();
  await p.getByRole("button",{name:/Task Account 배포/}).click();await p.getByRole("button",{name:"지갑 거래 영수증 확인",exact:true}).click();
  await p.getByRole("button",{name:/EIP-712 서명/}).click();await expect(p.getByRole("alert")).toBeVisible();
  expect(f.posts.some(x=>x.endsWith("/signature"))).toBe(false);expect(f.a.state).toBe("BOUND");
});
test("reload preserves pending hash and prevents duplicate deployment",async({page})=>{
  const f=await setup(page),p=page.getByRole("region",{name:"실제 Sepolia 구매 실행"});
  await p.getByRole("button",{name:"Mandate 확인 및 위임 승인 준비",exact:true}).click();
  await p.getByRole("button",{name:/Task Account 배포/}).click();await expect(p.getByRole("button",{name:"지갑 거래 영수증 확인",exact:true})).toBeVisible();
  await page.reload();
  await p.getByRole("button",{name:"계정·거래 상태 조회",exact:true}).click();
  await expect(p.getByRole("link",{name:"Sepolia 거래 확인 ↗",exact:true})).toHaveAttribute("href",`https://sepolia.etherscan.io/tx/${hash("1")}`);
  await expect(p.getByRole("button",{name:/Task Account 배포/})).toHaveCount(0);expect(f.sends).toHaveLength(1);
});
