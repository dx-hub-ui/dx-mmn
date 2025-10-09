import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const release = process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || "local";
const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";

const tracesSampleRate = Number(
  process.env.SENTRY_TRACES_SAMPLE_RATE ??
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
    "0.2"
);

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment,
  release,
  tracesSampleRate,
});
