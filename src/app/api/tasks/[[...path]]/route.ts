import { taskProxy } from "@/lib/api/task-proxy";
export const runtime = "nodejs";
async function handler(request: Request, context: { params: Promise<{ path?: string[] }> }) { return taskProxy(request, (await context.params).path ?? []); }
export { handler as GET, handler as POST };
