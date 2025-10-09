import { Resend } from "resend";
import { MailProvider, SendEmailRequest, SendEmailResponse, normalizeRecipients } from "./index";

const from = process.env.RESEND_FROM;
const replyTo = process.env.RESEND_REPLY_TO;

export class ResendMailProvider implements MailProvider {
  private client: Resend;
  public readonly name = "resend" as const;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    const recipients = normalizeRecipients(request.to).map((recipient) =>
      recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email
    );

    const response = await this.client.emails.send({
      from: from ?? "no-reply@dx.hub",
      reply_to: replyTo,
      to: recipients,
      subject: request.subject,
      html: request.html,
      text: request.text,
      headers: request.headers,
      tags: request.tags?.map((tag) => ({ name: tag, value: "true" })),
    });

    return {
      id: (response as { id?: string }).id ?? "",
      provider: this.name,
    };
  }
}
