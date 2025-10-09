import { MailProvider, SendEmailRequest, SendEmailResponse, normalizeRecipients } from "./index";

const baseUrl = process.env.BREVO_BASE_URL;
const defaultFrom = process.env.RESEND_FROM ?? "no-reply@dx.hub";

let cachedBrevo: any;

function loadBrevo() {
  if (!cachedBrevo) {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = eval("require") as (module: string) => any;
    cachedBrevo = req("@getbrevo/brevo");
  }
  return cachedBrevo;
}

export class BrevoMailProvider implements MailProvider {
  private client: any;
  public readonly name = "brevo" as const;

  constructor(apiKey: string) {
    const Brevo = loadBrevo();
    this.client = new Brevo.TransactionalEmailsApi();
    this.client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
    if (baseUrl) {
      this.client.setBasePath(baseUrl);
    }
  }

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    const recipients = normalizeRecipients(request.to).map((recipient) => ({
      email: recipient.email,
      name: recipient.name,
    }));

    const Brevo = loadBrevo();
    const payload = new Brevo.SendSmtpEmail();
    payload.subject = request.subject;
    payload.htmlContent = request.html;
    payload.textContent = request.text;
    payload.to = recipients;
    payload.headers = request.headers;
    payload.tags = request.tags;
    payload.sender = { email: defaultFrom };

    const response = await this.client.sendTransacEmail(payload);

    return {
      id: response.messageId ?? response.transactionalId ?? "",
      provider: this.name,
    };
  }
}
