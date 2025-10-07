export type TelemetryPayload = Record<string, unknown> | undefined;

type AnalyticsLike = {
  track?: (event: string, payload?: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    analytics?: AnalyticsLike;
    dataLayer?: { push: (event: Record<string, unknown>) => void };
  }
}

export function trackEvent(eventName: string, payload?: TelemetryPayload) {
  if (typeof window === "undefined") {
    return;
  }

  if (window.analytics?.track) {
    window.analytics.track(eventName, payload ?? {});
    return;
  }

  if (window.dataLayer?.push) {
    window.dataLayer.push({ event: eventName, ...(payload ?? {}) });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug(`[telemetry] ${eventName}`, payload ?? {});
  }
}
