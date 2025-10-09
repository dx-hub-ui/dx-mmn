import { trackServerEvent } from "@/lib/analytics/track";
import { getPostHogServerClient, shutdownPostHog } from "@/lib/analytics/posthog-server";

async function run() {
  const client = getPostHogServerClient();
  if (!client) {
    console.info("[posthog] API key missing, skipping smoke test");
    return;
  }

  await trackServerEvent("gamification:badge_earned", {
    badge: "smoke",
    reason: "health-check",
  });
  await shutdownPostHog();
  console.info("[posthog] smoke event enqueued");
}

run().catch((error) => {
  console.error("[posthog] smoke test failed", error);
  process.exit(1);
});
