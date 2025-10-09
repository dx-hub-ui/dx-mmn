async function main() {
  await import("./sentry");
  await import("./posthog");
  await import("./email");
}

main().catch((error) => {
  console.error("Smoke tests failed", error);
  process.exit(1);
});
