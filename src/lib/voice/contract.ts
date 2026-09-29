export const scenarioIntents = ["permitted", "over-budget", "recipient"] as const;
export type ScenarioIntent = (typeof scenarioIntents)[number];

/** Model output is untrusted; require the entire known argument shape. */
export function scenarioFromTool(value: unknown): ScenarioIntent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && scenarioIntents.includes(record.intent as ScenarioIntent)
    ? record.intent as ScenarioIntent : null;
}
