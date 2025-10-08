const sentryConfig = {
  org: process.env.SENTRY_ORG || "dx-hub",
  project: process.env.SENTRY_PROJECT || "dx-hub-app",
};

export default sentryConfig;
