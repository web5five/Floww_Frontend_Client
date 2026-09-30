import { redirect } from "next/navigation";
import VoicePage from "@/components/voice-page";
import { voiceUiEnabled } from "@/lib/voice/public-availability";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { taskId } = await searchParams;
  if (!voiceUiEnabled || process.env.FLOWW_VOICE_ENABLED !== "true") {
    const validTask = typeof taskId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    redirect(validTask ? `/chat/${encodeURIComponent(taskId)}` : "/pharmacy");
  }
  return <VoicePage />;
}
