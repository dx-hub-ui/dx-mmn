import "../../sentry.server.config";
import * as Sentry from "@sentry/nextjs";

async function run() {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.info("[sentry] DSN missing, skipping smoke test");
    return;
  }

  Sentry.captureMessage("observability:smoke", {
    level: "info",
  });

  await Sentry.flush(2000);
  console.info("[sentry] smoke message captured");
}

run().catch((error) => {
  console.error("[sentry] smoke test failed", error);
  process.exit(1);
});
