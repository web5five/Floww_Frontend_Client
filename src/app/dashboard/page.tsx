import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/locale-config";
import { ScenarioExperience } from "@/components/scenario-experience";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await cookies()).get(LOCALE_COOKIE)?.value === "en" ? "My purchases" : "내 구매" };
}
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { scenario } = await searchParams;
  return <main id="main" className="page-shell dashboard-shell"><ScenarioExperience initialScenario={scenario} /></main>;
}
