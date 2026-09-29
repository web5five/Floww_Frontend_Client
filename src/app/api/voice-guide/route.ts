import { stat } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const ready = await stat(path.join(process.cwd(), "public/audio/floww-intro-ko.mp3"))
    .then(file => file.isFile() && file.size > 0).catch(() => false);
  return Response.json({ ready, src: ready ? "/audio/floww-intro-ko.mp3" : null }, { headers: { "Cache-Control": "no-store" } });
}
