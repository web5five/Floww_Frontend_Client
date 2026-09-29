import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
export const metadata: Metadata = { title: "Dashboard" };
export default function DashboardPage() {
  const configured = Boolean(process.env.FLOWW_API_BASE_URL && (process.env.FLOWW_SERVER_DEV_TOKEN || process.env.FLOWW_WALLET_AUTH_ENABLED === "true"));
  return <main id="main" className="page-shell dashboard-shell"><Dashboard backendConfigured={configured} /></main>;
}
export const dynamic = "force-dynamic";
