import { z } from "zod";

import { attemptRelayDelivery } from "@/lib/comms";
import { env } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";

const bodySchema = z.object({
  eventId: z.string().min(1),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const relayHeader = request.headers.get("x-relay-token");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (relayHeader !== env.BOT_RELAY_TOKEN && bearerToken !== env.BOT_RELAY_TOKEN) {
    return jsonError("FORBIDDEN", "Invalid relay token.", 403);
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return jsonError(
      "INVALID_BODY",
      error instanceof Error ? error.message : "Invalid request payload.",
      400,
    );
  }

  const result = await attemptRelayDelivery(body.eventId);

  if (!result.success) {
    return jsonError("RELAY_DELIVERY_FAILED", result.error ?? "Relay delivery failed.", 502, result);
  }

  return jsonOk(result);
}
