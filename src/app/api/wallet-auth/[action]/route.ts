import { walletAuthProxy } from "@/lib/auth/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
async function handle(request: Request, { params }: { params: Promise<{ action: string }> }) {
  return walletAuthProxy(request, (await params).action);
}
export { handle as GET, handle as POST };
