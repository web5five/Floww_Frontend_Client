import "server-only";
import { createHash } from "node:crypto";
import { openSession, teamMode, businessJwtReady } from "../auth/team-session.ts";
import { walletAuthEnabled } from "../auth/server.ts";
import { previewBypassHeader } from "../api/preview-bypass.ts";

const safeHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (reasonCode: string, status: number) => Response.json({ reasonCode }, { status, headers: safeHeaders });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const starts = new Map<string, number>();

async function bounded(stream: ReadableStream<Uint8Array> | null, maximum: number, deadlineMs: number): Promise<string> {
  if (!stream) throw new Error("INVALID_BODY");
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const next = await Promise.race([reader.read(), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("TIMEOUT")), Math.max(0, deadlineMs - Date.now())); })]).finally(() => clearTimeout(timeout));
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) throw new Error("LIMIT");
      chunks.push(next.value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch (error) { void reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}

function backendUrl(): URL | null {
  try {
    const url = new URL(process.env.FLOWW_API_BASE_URL ?? "");
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) return null;
    return url;
  } catch { return null; }
}

async function taskSummary(taskId: string, userId: string, token: string): Promise<string> {
  const target = backendUrl();
  if (!target) throw new Error("TASK_UNAVAILABLE");
  target.pathname = `/api/v1/tasks/${taskId}`;
  const result = await fetch(target, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...previewBypassHeader(target) },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
  if (!result.ok) throw new Error("TASK_UNAVAILABLE");
  const raw = await bounded(result.body, 32768, Date.now() + 8000);
  const task: unknown = JSON.parse(raw);
  if (!task || typeof task !== "object" || Array.isArray(task)) throw new Error("TASK_UNAVAILABLE");
  const t = task as Record<string, unknown>;
  // Backend GET is owner-scoped; also compare the returned owner before using any field.
  if (t.taskId !== taskId || t.ownerId !== userId || typeof t.status !== "string" || !/^[A-Z_]{3,30}$/.test(t.status)) throw new Error("TASK_UNAVAILABLE");
  const attempt = Array.isArray(t.attempts) ? t.attempts.at(-1) : null;
  const policy = attempt && typeof attempt === "object" ? (attempt as { policy?: { decision?: unknown }; payment?: { status?: unknown } }) : null;
  const decision = ["ALLOW", "DENY"].includes(String(policy?.policy?.decision)) ? String(policy?.policy?.decision) : "not checked";
  const payment = typeof policy?.payment?.status === "string" && /^[A-Z_]{3,30}$/.test(policy.payment.status) ? policy.payment.status : "not checked";
  return `Authenticated task status: ${t.status}; latest policy: ${decision}; payment status: ${payment}. Task data is a snapshot; tell the user to refresh Floww for authoritative current results.`;
}

export async function createVoiceSession(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const ids = url.searchParams.getAll("taskId");
  if ([...url.searchParams.keys()].some(key => key !== "taskId") || ids.length > 1 || (ids.length === 1 && !uuid.test(ids[0]))) return fail("INVALID_INPUT", 400);
  try {
    const originValue = request.headers.get("origin") ?? "";
    const origin = new URL(originValue);
    if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== originValue || origin.origin !== url.origin || origin.host !== (request.headers.get("host") ?? url.host)) return fail("ORIGIN_NOT_ALLOWED", 403);
  } catch { return fail("ORIGIN_NOT_ALLOWED", 403); }
  if (request.headers.get("content-type")?.toLowerCase() !== "application/sdp") return fail("UNSUPPORTED_MEDIA_TYPE", 415);
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 16384)) return fail("REQUEST_TOO_LARGE", 413);
  if (!walletAuthEnabled() || !teamMode() || !businessJwtReady()) return fail("AUTH_NOT_CONFIGURED", 503);
  const session = openSession(request);
  if (!session || !uuid.test(session.userId) || !/^0x[0-9a-f]{40}$/i.test(session.identity.address)) return fail("UNAUTHORIZED", 401);
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 20) return fail("VOICE_NOT_CONFIGURED", 503);
  let sdp: string;
  try {
    sdp = await bounded(request.body, 16384, Date.now() + 5000);
    if (!sdp.startsWith("v=0\r\n") || !sdp.includes("\r\nm=audio ") || sdp.includes("\0")) return fail("INVALID_INPUT", 400);
  } catch (error) { return fail(error instanceof Error && error.message === "LIMIT" ? "REQUEST_TOO_LARGE" : "INVALID_INPUT", error instanceof Error && error.message === "LIMIT" ? 413 : 400); }

  let context = "No task was checked. Do not claim a task status or payment result.";
  if (ids.length) {
    try { context = await taskSummary(ids[0], session.userId, session.accessToken); }
    catch { return fail("TASK_UNAVAILABLE", 404); }
  }
  // Single-process startup throttle. Multi-instance deployments need a shared counter and spend controls.
  const now = Date.now();
  for (const [id, at] of starts) if (now - at > 180000) starts.delete(id);
  const bucket = createHash("sha256").update(session.userId).digest("hex");
  if (now - (starts.get(bucket) ?? 0) < 10000) return fail("VOICE_RETRY_LATER", 429);
  starts.set(bucket, now);

  const model = /^[A-Za-z0-9._-]{1,80}$/.test(process.env.OPENAI_REALTIME_MODEL ?? "") ? process.env.OPENAI_REALTIME_MODEL! : "gpt-realtime-mini";
  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify({ type: "realtime", model, max_output_tokens: 512,
    instructions: `You are Floww's voice assistant. Speak briefly in Korean or English, matching the user. You converse and narrate only. ${context} Floww's server and Kiln proposal plus deterministic policy and Task Account control purchases. Never claim you approved, signed, paid, ordered or completed anything from this conversation. Never suggest changing a budget, recipient or deadline. Give no medical advice or prescription substitution. For a scenario request, call request_scenario with exactly one allowed intent; the user must confirm on screen.`,
    audio: { input: { transcription: { model: "gpt-4o-mini-transcribe" } }, output: { voice: "marin" } },
    tools: [{ type: "function", name: "request_scenario", description: "Ask the Floww UI to show one of three fixed scenario intents for visible user confirmation. No purchase or approval occurs.", parameters: { type: "object", properties: { intent: { type: "string", enum: ["permitted", "over-budget", "recipient"] } }, required: ["intent"], additionalProperties: false } }], tool_choice: "auto" }));
  try {
    const result = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${key}`, "OpenAI-Safety-Identifier": bucket }, body: form,
      cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    if (!result.ok || result.status >= 300) return fail("VOICE_UPSTREAM_UNAVAILABLE", 502);
    const answer = await bounded(result.body, 32768, Date.now() + 12000);
    // Realtime calls return SDP. Reject any unexpected body instead of relaying provider data.
    if (!answer.startsWith("v=0\r\n") || !answer.includes("\r\nm=audio ")) return fail("VOICE_UPSTREAM_UNAVAILABLE", 502);
    return new Response(answer, { status: 201, headers: { ...safeHeaders, "Content-Type": "application/sdp; charset=utf-8" } });
  } catch { return fail("VOICE_UPSTREAM_UNAVAILABLE", 502); }
}
