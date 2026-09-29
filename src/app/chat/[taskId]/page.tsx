import type { Metadata } from "next";
import { ScenarioExperience } from "@/components/scenario-experience";
export const metadata: Metadata = { title: "작업 대화" };
export default async function ChatPage({ params, searchParams }: { params: Promise<{ taskId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const { taskId } = await params;
  const { scenario } = await searchParams;
  return <main id="main" className="page-shell dashboard-shell"><ScenarioExperience taskId={taskId} initialScenario={scenario} chat /></main>;
}
