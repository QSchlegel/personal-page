import { getTimelineProjects } from "@/lib/timeline";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const data = await getTimelineProjects();
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      "TIMELINE_FETCH_FAILED",
      error instanceof Error ? error.message : "Unable to fetch timeline projects.",
      500,
    );
  }
}
