import React, { type ReactNode } from "react";
import { renderEmail, EmailRecipient } from "@/lib/email";
import { getMailProvider } from "@/lib/email/provider";
import { TransactionalLayout } from "../../../emails/TransactionalLayout";
import { trackServerEvent } from "@/lib/analytics/track";

export type NotificationContext = {
  orgId?: string | null;
  userId?: string | null;
  requestId?: string | null;
};

type SendArgs = NotificationContext & {
  to: EmailRecipient;
  subject: string;
  heading: string;
  body: ReactNode;
  tags?: string[];
};

async function send({ to, subject, heading, body, tags, ...context }: SendArgs) {
  const provider = getMailProvider();

  await trackServerEvent("notifications:email_queued", {
    template: heading,
    provider: provider.name === "noop" ? undefined : provider.name,
    user_id: context.userId ?? undefined,
    org_id: context.orgId ?? undefined,
    request_id: context.requestId ?? undefined,
  });

  const html = renderEmail(
    <TransactionalLayout heading={heading} previewText={subject}>
      {body}
    </TransactionalLayout>
  );

  try {
    const response = await provider.send({
      to,
      subject,
      html,
      tags,
    });
    await trackServerEvent("notifications:email_sent", {
      notification_id: response.id,
      provider: provider.name === "noop" ? undefined : (response.provider as "resend" | "brevo" | undefined),
      template: heading,
      user_id: context.userId ?? undefined,
      org_id: context.orgId ?? undefined,
      request_id: context.requestId ?? undefined,
    });
    return response;
  } catch (error) {
    await trackServerEvent("notifications:email_failed", {
      template: heading,
      provider: provider.name === "noop" ? undefined : provider.name,
      error: error instanceof Error ? error.message : "unknown",
      user_id: context.userId ?? undefined,
      org_id: context.orgId ?? undefined,
      request_id: context.requestId ?? undefined,
    });
    throw error;
  }
}

export async function sendWelcomeEmail({ to, orgId, userId, requestId, dashboardUrl }: {
  to: EmailRecipient;
  orgId?: string | null;
  userId?: string | null;
  requestId?: string | null;
  dashboardUrl: string;
}) {
  return send({
    to,
    subject: "Bem-vindo ao DX Hub",
    heading: "Bem-vindo ao DX Hub",
    orgId,
    userId,
    requestId,
    tags: ["welcome"],
    body: (
      <>
        <p>Olá {to.name ?? ""},</p>
        <p>Seu workspace está pronto. Comece explorando seus playbooks e microsites.</p>
        <p>
          <a href={dashboardUrl}>Acessar painel</a>
        </p>
      </>
    ),
  });
}

export async function sendVerifyEmail({ to, verificationUrl, orgId, userId, requestId }: {
  to: EmailRecipient;
  verificationUrl: string;
  orgId?: string | null;
  userId?: string | null;
  requestId?: string | null;
}) {
  return send({
    to,
    subject: "Confirme seu e-mail",
    heading: "Confirme seu e-mail",
    orgId,
    userId,
    requestId,
    tags: ["verify"],
    body: (
      <>
        <p>Confirme seu endereço para liberar todos os recursos.</p>
        <p>
          <a href={verificationUrl}>Confirmar agora</a>
        </p>
      </>
    ),
  });
}

export async function sendPasswordlessMagicLink({ to, magicLink, orgId, userId, requestId }: {
  to: EmailRecipient;
  magicLink: string;
  orgId?: string | null;
  userId?: string | null;
  requestId?: string | null;
}) {
  return send({
    to,
    subject: "Seu link mágico de acesso",
    heading: "Entre com um clique",
    orgId,
    userId,
    requestId,
    tags: ["magic-link"],
    body: (
      <>
        <p>Use o link abaixo para acessar sua conta sem senha.</p>
        <p>
          <a href={magicLink}>Entrar agora</a>
        </p>
        <p>Este link expira em 15 minutos.</p>
      </>
    ),
  });
}
