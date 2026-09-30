# F037 Magic and MetaMask product wallet UI / 제품 지갑 UI

## 한국어

Floww 로그인 화면은 MetaMask 브라우저 지갑과 Magic 이메일 인증 지갑 두 가지를 제공합니다. Magic은 `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY`에 `pk_` 형식 공개 키가 설정된 경우에만 시작하며, 키가 없거나 형식이 잘못되면 SDK 호출과 OTP 요청 전에 비활성화합니다. 비밀 키를 클라이언트 변수에 넣지 않습니다.

Magic SDK `33.13.0`은 사용자가 이메일 로그인을 시작할 때 불러옵니다. 네트워크는 Sepolia `chainId: 11155111`, `rpcUrl: https://ethereum-sepolia-rpc.publicnode.com`으로 명시합니다. OTP 후 `eth_accounts`와 `eth_chainId`를 확인하고, 서버 `/api/wallet-auth`의 기존 nonce, SIWE 원문 서명, 검증, HttpOnly 세션, 로그아웃 절차를 그대로 사용합니다. 이메일, DID, 제공자 이름은 소유자 인증으로 쓰지 않습니다. 결제나 서명 권한은 로그인만으로 생기지 않습니다.

계정·네트워크 변경, 지갑 전환, 취소, 로그아웃, 컴포넌트 종료는 진행 중인 연결과 인증을 무효화합니다. OTP가 늦게 완료되면 이전 요청을 복구하지 않고 Magic 세션을 정리합니다. 로그아웃 실패 시 재연결을 막고 새로고침을 안내합니다. 기존 Task 요청은 같은 인증 세션·주소·Sepolia를 지갑 동작 직전에 다시 확인합니다.

배포 담당자는 공개 키와 서버 허용 origin/chain 설정을 주입하고 실제 이메일 OTP·서버 세션·복귀 경로를 별도로 검증해야 합니다. 이 변경의 자동 검사는 공개 형식의 합성 키와 SDK 테스트 객체를 사용하며 실제 OTP 성공을 주장하지 않습니다.

## English

Floww offers two sign-in methods: a MetaMask browser wallet and a Magic email wallet. Magic starts only when `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` contains a valid `pk_` publishable key. Missing or invalid configuration disables the choice before loading the SDK or requesting an OTP. Never put a Magic secret key in a client variable.

`magic-sdk@33.13.0` loads when the user starts email sign-in. Its network is explicitly Sepolia with `chainId: 11155111` and `rpcUrl: https://ethereum-sepolia-rpc.publicnode.com`. After OTP, the client reads `eth_accounts` and `eth_chainId`, then uses the existing `/api/wallet-auth` nonce, exact SIWE message signature, verification, HttpOnly session and logout. Email, DID and provider name never establish the owner identity. Sign-in alone does not approve spending or signing a purchase.

Account or network changes, wallet switching, cancellation, logout and unmount invalidate pending connection and authentication work. Late OTP completion cleans up the Magic session. A failed logout blocks reconnect and prompts a reload. Existing Task requests recheck the same authenticated session, address and Sepolia immediately before a wallet action.

The deployment owner must configure the publishable key and server origin/chain allowlists, then separately verify real email OTP, server session and return path. Automated checks here use a synthetic public-format key and SDK fixtures; they are not live OTP evidence.
