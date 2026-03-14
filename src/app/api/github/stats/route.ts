import { getGitHubStats } from "@/lib/github-stats";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const data = await getGitHubStats();
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      "GITHUB_STATS_FETCH_FAILED",
      error instanceof Error ? error.message : "Unable to fetch GitHub stats.",
      500,
    );
  }
}
