import type { Metadata } from "next";
import { PharmacyPreview } from "@/components/pharmacy-preview";
export const metadata: Metadata = { title: "Pharmacy mandate preview" };
export default function PharmacyPage() {
  return <main id="main" className="page-shell dashboard-shell"><PharmacyPreview /></main>;
}
