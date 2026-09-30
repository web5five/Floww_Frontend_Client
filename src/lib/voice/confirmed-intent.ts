import type { TaskView } from "@/lib/api/task-types";
import { scenarioIntents, type ScenarioIntent } from "./contract.ts";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const taskPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ownerPattern = /^0x[0-9a-f]{40}$/i;
const noncePattern = /^[0-9a-f-]{36}$/i;
const key = (owner: string, taskId: string) => `floww-voice-intent:${owner.toLowerCase()}:${taskId.toLowerCase()}`;

/** One browser-tab confirmation, bound to the signed-in owner and existing Task. */
export function stageVoiceIntent(store: Store, owner: string, taskId: string, intent: ScenarioIntent, now = Date.now(), nonce = crypto.randomUUID()): string {
  if (!ownerPattern.test(owner) || !taskPattern.test(taskId) || !scenarioIntents.includes(intent) || !noncePattern.test(nonce)) throw new Error("INVALID_VOICE_INTENT");
  store.setItem(key(owner, taskId), JSON.stringify({ owner: owner.toLowerCase(), taskId: taskId.toLowerCase(), intent, nonce, at: now }));
  return nonce;
}

/** Consume before reading or writing; one use within this tab. A cloned tab needs server checks too. */
export function consumeVoiceIntent(store: Store, owner: string, taskId: string, intent: string | undefined, nonce: string | undefined, now = Date.now()): intent is ScenarioIntent {
  if (!ownerPattern.test(owner) || !taskPattern.test(taskId) || !intent || !nonce) return false;
  const storageKey = key(owner, taskId), raw = store.getItem(storageKey);
  if (!raw) return false;
  store.removeItem(storageKey);
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(value).length === 5 && value.owner === owner.toLowerCase() && value.taskId === taskId.toLowerCase()
      && value.intent === intent && scenarioIntents.includes(intent as ScenarioIntent) && value.nonce === nonce && noncePattern.test(nonce)
      && typeof value.at === "number" && Number.isSafeInteger(value.at) && now >= value.at && now - value.at <= 120_000;
  } catch { return false; }
}

/** Voice may discuss any Task, but only this exact state may start a purchase conditions check. */
export function voiceScenarioAvailability(task: TaskView, owner: string, store: Store, now = Date.now()): "ready" | "decided" | "stopped" | "expired" | "uncertain" {
  if (!ownerPattern.test(owner) || !taskPattern.test(task.taskId)) return "stopped";
  if (store.getItem(`floww-task-stop:${task.taskId}`)) return "stopped";
  if (task.attempts.length) return "decided";
  if (task.status !== "AWAITING_APPROVAL") return "stopped";
  if (!(Date.parse(task.mandate.expiresAt) > now)) return "expired";
  if (store.getItem(`floww-scenario-decision:${owner.toLowerCase()}:${task.taskId}`)
    || store.getItem(`floww-scenario-quote-request:${owner.toLowerCase()}:${task.taskId}`)) return "uncertain";
  return "ready";
}
