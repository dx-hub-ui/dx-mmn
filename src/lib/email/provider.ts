import { EmailConfigurationError, MailProvider, SendEmailRequest, SendEmailResponse } from "./index";
import { ResendMailProvider } from "./resend";
import { BrevoMailProvider } from "./brevo";

const resendKey = process.env.RESEND_API_KEY;
const brevoKey = process.env.BREVO_API_KEY;
const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
const emailSendingEnabled = process.env.ENABLE_EMAIL_SEND === "true" || environment === "production";

class NoopMailProvider implements MailProvider {
  public readonly name = "noop" as const;

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    if (process.env.NODE_ENV !== "production") {
      console.info("[email] noop provider", request.subject, request.to);
    }
    return { id: "noop", provider: this.name };
  }
}

let provider: MailProvider | null = null;

export function getMailProvider(): MailProvider {
  if (provider) {
    return provider;
  }

  if (!emailSendingEnabled) {
    provider = new NoopMailProvider();
    return provider;
  }

  if (resendKey) {
    provider = new ResendMailProvider(resendKey);
    return provider;
  }

  if (brevoKey) {
    provider = new BrevoMailProvider(brevoKey);
    return provider;
  }

  throw new EmailConfigurationError("No email provider configured");
}

export function getEmailProviderSummary() {
  if (!emailSendingEnabled) {
    return { provider: "noop", enabled: false } as const;
  }
  if (resendKey) {
    return { provider: "resend", enabled: true } as const;
  }
  if (brevoKey) {
    return { provider: "brevo", enabled: true } as const;
  }
  return { provider: null, enabled: false } as const;
}
