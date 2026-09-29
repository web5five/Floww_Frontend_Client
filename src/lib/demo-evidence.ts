/** Local rehearsal only. These are not server Task states or transaction evidence. */
export type RehearsalScenario = "normal" | "over-budget" | "wrong-recipient";
export type RehearsalStatus = "READY" | "ALLOW" | "DENY" | "REVIEWED" | "STOPPED";
export interface RehearsalEvent { at: string; reason: string; status: RehearsalStatus }
export interface RehearsalState { scenario: RehearsalScenario; status: RehearsalStatus; events: RehearsalEvent[] }
export const initialRehearsal: RehearsalState = { scenario: "normal", status: "READY", events: [] };
export type RehearsalAction = { type: "select"; scenario: RehearsalScenario } | { type: "check" | "review" | "stop"; at: string };
export function rehearsalReducer(state: RehearsalState, action: RehearsalAction): RehearsalState {
  if (state.status === "STOPPED") return state;
  if (action.type === "select") return { ...state, scenario: action.scenario, status: "READY" };
  let status: RehearsalStatus, reason: string;
  if (action.type === "stop") { status = "STOPPED"; reason = "USER_STOPPED_LOCAL_REHEARSAL"; }
  else if (action.type === "check" && state.status === "READY") {
    status = state.scenario === "normal" ? "ALLOW" : "DENY";
    reason = state.scenario === "over-budget" ? "BUDGET_EXCEEDED" : state.scenario === "wrong-recipient" ? "RECIPIENT_NOT_ALLOWED" : "FIXTURE_CONDITIONS_MATCH";
  } else if (action.type === "review" && state.status === "ALLOW") { status = "REVIEWED"; reason = "LOCAL_REVIEW_ONLY_NOT_AUTHORIZATION"; }
  else return state;
  return { ...state, status, events: [...state.events, { at: action.at, status, reason }] };
}
export const requiredEvidence = [
  "Wallet authentication", "Task / Mandate / version", "3 pharmacy quotes", "Kiln qwen3-32b proposal",
  "Policy ALLOW", "User approval / EIP-712", "Smart Account execution", "Sepolia fUSDC transaction",
  "Transaction hash", "Confirmed receipt", "Simulated fulfillment", "Fulfillment verification", "Task COMPLETED",
] as const;
