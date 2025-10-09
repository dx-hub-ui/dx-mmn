"use client";

import { useEffect } from "react";
import AppShell from "@/components/ui/AppShell";
import { getRequestId } from "@/lib/request-context";
import * as Sentry from "@sentry/nextjs";
import { Button, Text } from "@vibe/core";
import Link from "next/link";

export default function NotFound() {
  useEffect(() => {
    Sentry.captureMessage("not-found", {
      level: "warning",
      tags: { request_id: getRequestId() ?? "unknown" },
    });
  }, []);

  return (
    <AppShell>
      <div className="px-6 py-12 space-y-4">
        <Text type={Text.types.TEXT1} weight={Text.weights.BOLD}>
          Página não encontrada
        </Text>
        <Text type={Text.types.TEXT3}>A página que você procura não existe ou foi movida.</Text>
        <Link href="/">
          <Button kind={Button.kinds.PRIMARY}>Voltar para o início</Button>
        </Link>
      </div>
    </AppShell>
  );
}
