import Link from "next/link";
import { ArrowUpRight, Inbox, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
export function GetStarted({ children = "구매 데모 시작" }: { children?: ReactNode }) {
  return <Link href="/pharmacy" className="button primary">{children}<ArrowUpRight size={20} /></Link>;
}
export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`card ${className}`}>{children}</section>;
}
export function MockBadge() { return <span className="mock-badge"><span />MOCK DATA</span>; }
export function LoadingState({ message = "데모 데이터를 불러오는 중입니다." }: { message?: string }) {
  return <div className="state" role="status"><LoaderCircle className="spin" size={28} /><h2>잠시만 기다려 주세요</h2><p>{message}</p></div>;
}
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return <div className="state" role="alert"><TriangleAlert size={28} /><h2>화면을 불러오지 못했어요</h2><p>잠시 후 다시 시도해 주세요.</p>{onRetry && <button className="button primary" onClick={onRetry}>다시 시도</button>}</div>;
}
export function EmptyState({ title = "아직 내역이 없어요", description = "새로운 내역이 생기면 이곳에 표시됩니다." }: { title?: string; description?: string }) {
  return <div className="state empty"><Inbox size={26} /><h3>{title}</h3><p>{description}</p></div>;
}
