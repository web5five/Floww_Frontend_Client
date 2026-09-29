import { getDashboard } from "@/lib/api/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json({ data: await getDashboard() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "DASHBOARD_UNAVAILABLE", message: "대시보드를 불러오지 못했습니다." } }, { status: 503 });
  }
}
