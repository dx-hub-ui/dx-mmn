#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { getRelease } = require("./utils/release");

const requiredEnv = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"];
const hasAllRequiredEnv = requiredEnv.every((key) => Boolean(process.env[key]));
const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";

if (!hasAllRequiredEnv) {
  console.warn("[sentry] Missing credentials. Sourcemaps upload skipped.");
  process.exit(0);
}

if (environment !== "production") {
  console.info(`[sentry] Environment '${environment}' detected. Sourcemaps upload skipped.`);
  process.exit(0);
}

const buildDir = path.join(process.cwd(), ".next");
if (!fs.existsSync(buildDir)) {
  console.warn("[sentry] Build directory not found. Sourcemaps upload skipped.");
  process.exit(0);
}

const release = getRelease();
const args = [
  "releases",
  "files",
  release,
  "upload-sourcemaps",
  buildDir,
  "--url-prefix",
  "~/_next",
  "--rewrite",
];

const result = spawnSync("sentry-cli", args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(result.status ?? 1);
}
