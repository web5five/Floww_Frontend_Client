// Run manually once. No browser key, live TTS endpoint, automatic retry or build hook.
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw new Error("Could not read .env.local"); }
const target = resolve("public/audio/floww-intro-ko.mp3");
try {
  if (process.env.FLOWW_VOICE_ENABLED !== "true") throw new Error("Voice generation is disabled. No request sent.");
  const { text } = JSON.parse(await readFile("src/lib/voice-script.json", "utf8"));
  const existing = await stat(target).catch(() => null);
  if (existing?.size) throw new Error("Audio already exists. Review it before explicitly replacing the file; no paid request was sent.");
  const key = process.env.ELEVENLABS_API_KEY, voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) throw new Error("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env.local. No request sent.");
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(voice)) throw new Error("Invalid voice ID. No request sent.");
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(90000),
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!response.ok) throw new Error(`ElevenLabs HTTP ${response.status}. No automatic retry; inspect provider history before another paid request.`);
  if (!response.headers.get("content-type")?.includes("audio/mpeg")) throw new Error("Unexpected audio response; no file saved.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100 || bytes.length > 10_000_000) throw new Error("Invalid audio size; no file saved.");
  await mkdir(resolve("public/audio"), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  console.log("Saved public/audio/floww-intro-ko.mp3. Listen and review before publishing.");
} catch (error) {
  // Never print provider payloads, environment values, request headers or SDK errors.
  const message = error instanceof Error ? error.message : "Voice generation failed";
  const safe = /^(Voice generation is disabled|Set ELEVENLABS_|Audio already|Invalid voice|ElevenLabs HTTP|Unexpected audio|Invalid audio)/.test(message);
  console.error(safe ? message : "Voice generation failed. No automatic retry; check provider history before retrying.");
  process.exitCode = 1;
}
