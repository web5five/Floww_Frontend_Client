import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/locale-config";
import { redirect } from "next/navigation";
import { ScenarioExperience } from "@/components/scenario-experience";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await cookies()).get(LOCALE_COOKIE)?.value === "en" ? "Pharmacy purchase" : "약국 구매" };
}
export default async function PharmacyPage({ searchParams }: { searchParams: Promise<{ scenario?: string; taskId?: string }> }) {
  const { scenario, taskId } = await searchParams;
  if (taskId) redirect(`/journey/${encodeURIComponent(taskId)}/mandate${scenario ? `?scenario=${encodeURIComponent(scenario)}` : ""}`);
  return <main id="main" className="page-shell dashboard-shell"><ScenarioExperience initialScenario={scenario} /></main>;
}
