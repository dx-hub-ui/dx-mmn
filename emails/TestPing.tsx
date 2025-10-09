import React, { type ReactElement } from "react";
import { TransactionalLayout } from "./TransactionalLayout";

export function TestPingEmail(): ReactElement {
  return (
    <TransactionalLayout heading="Integração de e-mail verificada" previewText="Integração DX Hub">
      <p>Este é um disparo de teste para confirmar a integração dos provedores.</p>
      <p>
        Nenhuma ação é necessária. Caso você não esteja esperando este e-mail, basta ignorá-lo — nada foi
        alterado na sua conta.
      </p>
    </TransactionalLayout>
  );
}
