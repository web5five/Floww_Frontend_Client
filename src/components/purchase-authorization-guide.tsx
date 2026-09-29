import { Card } from "./ui";
const interactions = [
  ["1. TaskAccount 배포", "서버가 고정한 구매 조건과 생성자 인자를 확인하고, 소유자 지갑이 배포합니다. 백엔드가 RPC로 코드와 계정 설정을 검증해야 합니다."],
  ["2. MandateApproval 서명", "서버가 최종 계정에서 읽은 nonce와 생성한 typed data를 확인합니다. 로그인 서명과 다른 지출 권한 서명입니다."],
  ["3. 승인 기록", "서버의 서명 검증 후 approveMandate(signature)를 온체인에 기록합니다. 이 단계만으로 결제가 완료되지는 않습니다."],
  ["4. fUSDC allowance", "선택 구매의 TaskAccount가 토큰을 가져갈 수 있도록 허용합니다. 무제한 allowance를 기본값으로 사용하지 않습니다."],
  ["5. 선택 금액 충전", "소유자가 fund()를 실행합니다. 약국 A 예시는 23.5 fUSDC이며 Sepolia ETH도 필요합니다. 서버가 충전 결과를 확인합니다."],
  ["6. 실행·이행 결과 확인", "서버 실행기가 고정 금액으로 지급하고 영수증의 수신자·금액·paymentId를 검증합니다. FulfillmentConfirmed 이벤트 확인 후에만 Task가 완료됩니다."],
];
export function PurchaseAuthorizationGuide() {
  return <Card id="purchase-authorization-guide" className="pharmacy-section"><div className="section-heading"><h2>선택한 구매 한 건에 대한 승인</h2><span className="tag">지갑 실행 연결 전</span></div><p>AI 선택 → 정책 ALLOW → 판매처·견적 고정 → 사용자 승인 → 해당 구매 실행. 승인 후 다른 약국으로 바꾸는 권한을 부여하지 않습니다.</p><dl className="purchase-details"><div><dt>Task 전체 정책 한도</dt><dd>60 fUSDC · 60000000</dd></div><div><dt>약국 A 고정 견적 예시</dt><dd>23.5 fUSDC · 23500000</dd></div><div><dt>선택 구매 TaskAccount 한도</dt><dd>고정된 견적과 동일 · A 예시는 23.5 fUSDC</dd></div><div><dt>실제 지급 조건</dt><dd>고정 견적 금액과 정확히 일치해야 함</dd></div></dl><p className="form-note">위 수치는 팀 시나리오 예시이며 현재 사용자의 계정·잔액·승인이 아닙니다. 한 번의 구매 결정에 아래 여러 지갑 요청이 따를 수 있습니다. 요청 수를 구매 승인 횟수로 오해하지 마세요.</p><ol className="wallet-steps">{interactions.map(([name, description]) => <li key={name}><strong>{name}</strong><p>{description}</p><span className="tag">연결 전 · 실행하지 않음</span></li>)}</ol><p className="form-note">MandateApproval의 domain은 FlowwTaskAccount, version 1, Sepolia 11155111, 최종 계정의 verifyingContract입니다. 서버의 고정 구매 원본과 reviewSnapshotDigest가 일치해야 합니다. 예전 PurchaseApproval 서명이나 예전 테스트 계정을 재사용하지 않습니다. 지급 결과가 불명확하면 재전송하지 않고 기존 paymentId·영수증·이벤트를 먼저 확인합니다.</p></Card>;
}
