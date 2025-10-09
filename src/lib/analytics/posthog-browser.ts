import type { PostHog } from "posthog-js";

export type PostHogClient = PostHog & { __loaded?: boolean };

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

let posthogPromise: Promise<PostHogClient | null> | null = null;
let cachedClient: PostHogClient | null = null;

export function getPosthogBrowserClient() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!key) {
    if (process.env.NODE_ENV === "development" && !posthogPromise) {
      console.info("[posthog] NEXT_PUBLIC_POSTHOG_KEY missing. Analytics disabled.");
    }
    return Promise.resolve(null);
  }

  if (cachedClient) {
    return Promise.resolve(cachedClient);
  }

  if (!posthogPromise) {
    posthogPromise = import("posthog-js").then((module) => {
      const client = module.default as PostHogClient;
      if (!client.__loaded) {
        client.init(key, {
          api_host: host,
          capture_pageview: false,
          capture_pageleave: true,
          persistence: "localStorage+cookie",
          disable_session_recording: false,
          autocapture: true,
        });
        client.__loaded = true;
      }
      cachedClient = client;
      return client;
    });
  }

  return posthogPromise;
}
