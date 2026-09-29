import type { Metadata } from "next";
import { ScenarioExperience } from "@/components/scenario-experience";
export const metadata: Metadata = { title: "약국 구매" };
export default async function PharmacyPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { scenario } = await searchParams;
  return <main id="main" className="page-shell dashboard-shell"><ScenarioExperience initialScenario={scenario} /></main>;
}
