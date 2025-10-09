import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const response = {
    timestamp: new Date().toISOString(),
    sentry: {
      clientDsn: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
      authToken: Boolean(process.env.SENTRY_AUTH_TOKEN),
      org: Boolean(process.env.SENTRY_ORG),
      project: Boolean(process.env.SENTRY_PROJECT),
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    },
    posthog: {
      clientKey: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
      clientHost: Boolean(process.env.NEXT_PUBLIC_POSTHOG_HOST),
      serverKey: Boolean(process.env.POSTHOG_API_KEY),
      serverHost: Boolean(process.env.POSTHOG_HOST),
    },
  } as const;

  return NextResponse.json(response, { status: 200 });
}
