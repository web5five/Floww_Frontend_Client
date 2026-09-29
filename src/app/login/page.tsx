import type { Metadata } from "next";
import { WalletLogin } from "@/components/wallet-login";
export const metadata: Metadata = { title: "지갑 로그인" };
export default function LoginPage() { return <WalletLogin />; }
