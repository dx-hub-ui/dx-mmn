import { captureException } from "@sentry/nextjs";
import { getPosthogBrowserClient } from "./posthog-browser";
import { getPostHogServerClient } from "./posthog-server";
import { EventName, EventPayload, validateEvent } from "./events";
import { getRequestContext } from "../request-context";

const isProduction = process.env.NODE_ENV === "production";

type TrackOptions = {
  distinctId?: string | null;
  context?: Partial<{
    user_id: string | null | undefined;
    org_id: string | null | undefined;
    request_id: string | null | undefined;
  }>;
};

type ResolvedContext = {
  user_id?: string;
  org_id?: string;
  request_id?: string;
};

function buildContext(options?: TrackOptions): ResolvedContext {
  const runtimeContext = getRequestContext();
  const contextOverride = options?.context ?? {};

  const userId = contextOverride.user_id ?? runtimeContext?.userId ?? undefined;
  const orgId = contextOverride.org_id ?? runtimeContext?.orgId ?? undefined;
  const requestId = contextOverride.request_id ?? runtimeContext?.requestId ?? undefined;

  return {
    user_id: userId ?? undefined,
    org_id: orgId ?? undefined,
    request_id: requestId ?? undefined,
  };
}

function validate<Name extends EventName>(name: Name, payload: Record<string, unknown>) {
  const result = validateEvent(name, payload);
  if (!result.success) {
    if (isProduction) {
      captureException(result.error, {
        tags: { module: "analytics", event: name },
      });
      return null;
    }

    throw result.error;
  }

  return result.data;
}

function resolveDistinctId<Name extends EventName>(
  payload: EventPayload<Name>,
  options?: TrackOptions
) {
  return (
    options?.distinctId ||
    ("user_id" in payload ? (payload as { user_id?: string }).user_id : undefined) ||
    ("org_id" in payload ? (payload as { org_id?: string }).org_id : undefined) ||
    ("request_id" in payload ? (payload as { request_id?: string }).request_id : undefined) ||
    undefined
  );
}

export async function trackClientEvent<Name extends EventName>(
  name: Name,
  payload: EventPayload<Name>,
  options?: TrackOptions
) {
  const context = buildContext(options);
  const eventPayload = validate(name, { ...payload, ...context });
  if (!eventPayload) {
    return;
  }

  const client = await getPosthogBrowserClient();
  if (!client) {
    return;
  }

  const distinctId = resolveDistinctId(eventPayload, options);

  client.capture(name, {
    ...eventPayload,
    distinct_id: distinctId ?? "anonymous",
  });
}

export async function trackServerEvent<Name extends EventName>(
  name: Name,
  payload: EventPayload<Name>,
  options?: TrackOptions
) {
  if (typeof process !== "undefined" && process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime should rely on browser capture only.
    return;
  }

  const context = buildContext(options);
  const eventPayload = validate(name, { ...payload, ...context });
  if (!eventPayload) {
    return;
  }

  const client = getPostHogServerClient();
  if (!client) {
    return;
  }

  const distinctId = resolveDistinctId(eventPayload, options);

  await client.capture({
    event: name,
    properties: eventPayload,
    distinctId: distinctId ?? "server-anonymous",
  });
}
