import { createVoiceSession } from "@/lib/voice/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return createVoiceSession(request); }
