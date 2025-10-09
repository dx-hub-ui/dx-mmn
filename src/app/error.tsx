"use client";

import { useEffect } from "react";
import AppShell from "@/components/ui/AppShell";
import { trackClientEvent } from "@/lib/analytics/track";
import { getRequestId } from "@/lib/request-context";
import * as Sentry from "@sentry/nextjs";
import { Button, Text } from "@vibe/core";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
    trackClientEvent("errors:client_runtime", {
      message: error.message,
      request_id: getRequestId(),
    }).catch(() => undefined);
  }, [error]);

  return (
    <AppShell>
      <div className="px-6 py-12 space-y-4">
        <Text type={Text.types.TEXT1} weight={Text.weights.BOLD}>
          Algo deu errado
        </Text>
        <Text type={Text.types.TEXT3}>
          Nossa equipe foi notificada e já está investigando.
        </Text>
        <Button kind={Button.kinds.SECONDARY} onClick={() => reset()}>
          Tentar novamente
        </Button>
      </div>
    </AppShell>
  );
}
