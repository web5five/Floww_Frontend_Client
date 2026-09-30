"use client";

import Link from "next/link";
import { ArrowUpRight, Inbox, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n";
export function GetStarted({ children }: { children?: ReactNode }) {
  const { t } = useLocale();
  return <Link href="/pharmacy" className="button primary">{children ?? t("구매 시작", "Start purchase")}<ArrowUpRight size={20} /></Link>;
}
export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`card ${className}`}>{children}</section>;
}
export function LoadingState({ message }: { message?: string }) {
  const { t } = useLocale();
  return <div className="state" role="status"><LoaderCircle className="spin" size={28} /><h2>{t("잠시만 기다려 주세요", "Please wait")}</h2><p>{message ?? t("화면을 불러오는 중입니다.", "Loading this screen.")}</p></div>;
}
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLocale();
  return <div className="state" role="alert"><TriangleAlert size={28} /><h2>{t("화면을 불러오지 못했어요", "Could not load this screen")}</h2><p>{t("잠시 후 다시 시도해 주세요.", "Please try again shortly.")}</p>{onRetry && <button className="button primary" onClick={onRetry}>{t("다시 시도", "Try again")}</button>}</div>;
}
export function EmptyState({ title, description }: { title?: string; description?: string }) {
  const { t } = useLocale();
  return <div className="state empty"><Inbox size={26} /><h3>{title ?? t("아직 내역이 없어요", "No activity yet")}</h3><p>{description ?? t("새로운 내역이 생기면 이곳에 표시됩니다.", "New activity will appear here.")}</p></div>;
}
