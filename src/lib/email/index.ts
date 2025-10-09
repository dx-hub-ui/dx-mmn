import type { ReactElement } from "react";

export type EmailRecipient = {
  email: string;
  name?: string;
};

export type SendEmailRequest = {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  tags?: string[];
};

export type SendEmailResponse = {
  id: string;
  provider: string;
};

export interface MailProvider {
  name: "resend" | "brevo" | "noop";
  send(request: SendEmailRequest): Promise<SendEmailResponse>;
}

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export function normalizeRecipients(to: EmailRecipient | EmailRecipient[]) {
  return Array.isArray(to) ? to : [to];
}

export function renderEmail(element: ReactElement) {
  const req = eval("require") as (module: string) => any;
  const { renderToStaticMarkup } = req("react-dom/server") as typeof import("react-dom/server");
  const html = renderToStaticMarkup(element);
  return "<!DOCTYPE html>" + html;
}
