import { PostHog } from "posthog-node";
import type { TelemetryOptions, TelemetryPayload } from "./telemetry";

let client: PostHog | null = null;

function getClient() {
  if (client) {
    return client;
  }

  const apiKey = process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

  if (!apiKey) {
    return null;
  }

  client = new PostHog(apiKey, {
    host,
    flushAt: 1,
    flushInterval: 0,
    disableGeoip: true,
  });

  return client;
}

function buildGroupPayload(groups?: TelemetryOptions["groups"]) {
  const payload: Record<string, unknown> = {};

  if (groups?.orgId) {
    payload.$group_0 = groups.orgId;
  }

  if (groups?.sequenceId) {
    payload.$group_1 = groups.sequenceId;
  }

  return payload;
}

export async function trackServerEvent(
  eventName: string,
  payload?: TelemetryPayload,
  options?: TelemetryOptions
) {
  const posthog = getClient();

  if (!posthog) {
    if (process.env.NODE_ENV === "development") {
      console.info("[posthog] cliente não configurado", { eventName, payload, options });
    }
    return;
  }

  const properties = {
    ...(payload ?? {}),
    ...buildGroupPayload(options?.groups),
  };

  posthog.capture({
    event: eventName,
    distinctId: options?.distinctId ?? "server-action",
    properties,
  });

  if (process.env.NODE_ENV !== "production") {
    await posthog.flushAsync();
  }
}
