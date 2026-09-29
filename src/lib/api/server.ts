import "server-only";
import { mockDashboard } from "./mock";
import type { DashboardData } from "./types";

/** Replace here after backend contracts/authentication are agreed.
 * Keep upstream URLs and credentials server-only. Never return raw upstream errors.
 * Environment values intentionally do not enable an unimplemented live mode.
 */
export async function getDashboard(): Promise<DashboardData> {
  return structuredClone(mockDashboard);
}
