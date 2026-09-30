import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/locale-config";
import { notFound } from "next/navigation";
import { ScenarioExperience, type JourneyStep } from "@/components/scenario-experience";

const steps: JourneyStep[] = ["mandate", "decision", "approval", "result"];
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await cookies()).get(LOCALE_COOKIE)?.value === "en" ? "Purchase progress" : "구매 진행" };
}

export default async function JourneyPage({ params, searchParams }: {
  params: Promise<{ taskId: string; step: string }>;
  searchParams: Promise<{ scenario?: string }>;
}) {
  const [{ taskId, step }, { scenario }] = await Promise.all([params, searchParams]);
  if (!steps.some(item => item === step)) notFound();
  return <main id="main" className="page-shell dashboard-shell journey-shell">
    <ScenarioExperience key={`${taskId}:${step}`} taskId={taskId} initialScenario={scenario} step={step as JourneyStep} />
  </main>;
}
