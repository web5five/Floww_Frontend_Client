import type { Metadata } from "next";
import { ScenarioExperience } from "@/components/scenario-experience";
export const metadata: Metadata = { title: "약국 구매" };
export default async function PharmacyPage({ searchParams }: { searchParams: Promise<{ scenario?: string; taskId?: string }> }) {
  const { scenario, taskId } = await searchParams;
  return <main id="main" className="page-shell dashboard-shell"><ScenarioExperience initialScenario={scenario} taskId={taskId} /></main>;
}
