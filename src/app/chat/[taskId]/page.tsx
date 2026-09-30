import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/locale-config";
import { ScenarioExperience } from "@/components/scenario-experience";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await cookies()).get(LOCALE_COOKIE)?.value === "en" ? "Task conversation" : "작업 대화" };
}
export default async function ChatPage({ params, searchParams }: { params: Promise<{ taskId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const { taskId } = await params;
  const { scenario } = await searchParams;
  return <main id="main" className="page-shell dashboard-shell"><ScenarioExperience taskId={taskId} initialScenario={scenario} chat /></main>;
}
