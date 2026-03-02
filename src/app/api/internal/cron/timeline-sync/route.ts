import { env } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { syncGithubProjects } from "@/lib/timeline";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");

  if (!secret || secret !== env.CRON_SECRET) {
    return jsonError("FORBIDDEN", "Invalid cron secret.", 403);
  }

  try {
    const result = await syncGithubProjects();
    return jsonOk({
      ok: true,
      ...result,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonError(
      "SYNC_FAILED",
      error instanceof Error ? error.message : "Timeline sync failed.",
      500,
    );
  }
}
