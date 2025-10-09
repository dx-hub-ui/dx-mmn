import { NextResponse } from "next/server";
import { getEmailProviderSummary } from "@/lib/email/provider";

export const runtime = "nodejs";

export async function GET() {
  const summary = getEmailProviderSummary();
  const response = {
    timestamp: new Date().toISOString(),
    provider: summary.provider,
    enabled: summary.enabled,
    fromConfigured: Boolean(process.env.RESEND_FROM),
    replyToConfigured: Boolean(process.env.RESEND_REPLY_TO),
    keys: {
      resend: Boolean(process.env.RESEND_API_KEY),
      brevo: Boolean(process.env.BREVO_API_KEY),
    },
  };

  return NextResponse.json(response, { status: 200 });
}
