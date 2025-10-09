import "./sentry.server.config";

export async function register() {
  if (process.env.NODE_ENV !== "production") {
    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      console.info("[observability] Sentry DSN not provided. Server instrumentation will no-op.");
    }
    if (!process.env.POSTHOG_API_KEY && !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      console.info("[observability] PostHog keys not provided. Analytics will no-op.");
    }
  }
}

export function onRequest() {
  // Edge runtime entrypoint ensures edge configuration is bundled.
  // Next.js automatically loads `sentry.edge.config.ts` for middleware/edge.
  return;
}
