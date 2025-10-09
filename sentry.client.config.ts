import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
const release = process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || "local";
const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";

const tracesSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
    process.env.SENTRY_TRACES_SAMPLE_RATE ??
    "0.2"
);

const replaysSessionSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ??
    process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE ??
    "0.1"
);

const replaysOnErrorSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ERROR_SAMPLE_RATE ??
    process.env.SENTRY_REPLAYS_ERROR_SAMPLE_RATE ??
    "1.0"
);

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment,
  release,
  tracesSampleRate,
  replaysSessionSampleRate,
  replaysOnErrorSampleRate,
  integrations: [Sentry.replayIntegration()],
  tracePropagationTargets: ["^https://"],
  autoSessionTracking: true,
});
