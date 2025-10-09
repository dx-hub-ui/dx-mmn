import { PostHog } from "posthog-node";

const key = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

let client: PostHog | null = null;

export function getPostHogServerClient() {
  if (!key) {
    return null;
  }

  if (client) {
    return client;
  }

  client = new PostHog(key, {
    host,
    flushAt: 1,
    flushInterval: 1000,
  });

  return client;
}

export function shutdownPostHog() {
  if (!client) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    client?.flush(() => {
      client?.shutdown();
      client = null;
      resolve();
    });
  });
}
