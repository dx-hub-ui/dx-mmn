#!/usr/bin/env node

const { spawnSync } = require("child_process");
const { getRelease } = require("./release");

const release = getRelease();

if (!process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT) {
  console.warn("[sentry] Missing authentication environment variables. Skipping release creation.");
  process.exit(0);
}

const result = spawnSync(
  "sentry-cli",
  ["releases", "new", release],
  {
    stdio: "inherit",
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(result.status ?? 1);
}
