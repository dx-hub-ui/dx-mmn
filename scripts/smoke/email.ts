import React from "react";
import { renderEmail } from "@/lib/email";
import { getEmailProviderSummary } from "@/lib/email/provider";
import { TestPingEmail } from "../../emails/TestPing";

async function run() {
  const summary = getEmailProviderSummary();
  const html = renderEmail(React.createElement(TestPingEmail));
  console.info("[email] rendered length", html.length);
  console.info("[email] provider summary", summary);
}

run().catch((error) => {
  console.error("[email] smoke test failed", error);
  process.exit(1);
});
