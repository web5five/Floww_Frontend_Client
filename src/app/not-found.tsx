"use client";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { useLocale } from "@/lib/i18n";
export default function NotFound() { const { t } = useLocale(); return <main id="main" className="page-shell not-found"><EmptyState title={t("페이지를 찾을 수 없어요", "Page not found")} description={t("주소를 확인하거나 Floww 홈으로 돌아가세요.", "Check the address or return to Floww home.")} /><Link className="button primary" href="/">{t("홈으로 돌아가기", "Return home")}</Link></main>; }
