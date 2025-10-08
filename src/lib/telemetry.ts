export type TelemetryPayload = Record<string, unknown> | undefined;

type AnalyticsLike = {
  track?: (event: string, payload?: Record<string, unknown>) => void;
};

type TelemetryGroups = {
  orgId?: string | null;
  sequenceId?: string | null;
};

export type TelemetryOptions = {
  groups?: TelemetryGroups;
  distinctId?: string | null;
};

declare global {
  interface Window {
    analytics?: AnalyticsLike;
    dataLayer?: { push: (event: Record<string, unknown>) => void };
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      group?: (groupType: string, groupKey: string, properties?: Record<string, unknown>) => void;
      reset?: () => void;
    };
  }
}

function buildGroupPayload(groups?: TelemetryGroups) {
  const payload: Record<string, unknown> = {};

  if (groups?.orgId) {
    payload.$group_0 = groups.orgId;
  }

  if (groups?.sequenceId) {
    payload.$group_1 = groups.sequenceId;
  }

  return payload;
}

export function trackEvent(eventName: string, payload?: TelemetryPayload, options?: TelemetryOptions) {
  if (typeof window === "undefined") {
    return;
  }

  const enrichedPayload = {
    ...(payload ?? {}),
    ...buildGroupPayload(options?.groups),
  };

  if (window.posthog?.capture) {
    window.posthog.capture(eventName, enrichedPayload);
    return;
  }

  if (window.analytics?.track) {
    window.analytics.track(eventName, enrichedPayload);
    return;
  }

  if (window.dataLayer?.push) {
    window.dataLayer.push({ event: eventName, ...enrichedPayload });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug(`[telemetry] ${eventName}`, enrichedPayload);
  }
}
