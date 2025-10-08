"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

declare global {
  interface Window {
    __posthogInitialized?: boolean;
  }
}

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

export default function PostHogProvider() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!POSTHOG_KEY) {
      if (process.env.NODE_ENV === "development") {
        console.info("[posthog] NEXT_PUBLIC_POSTHOG_KEY ausente, eventos serão ignorados.");
      }
      return;
    }

    if (!window.__posthogInitialized) {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false,
        capture_pageleave: true,
        persistence: "localStorage+cookie",
        disable_session_recording: true,
      });
      window.__posthogInitialized = true;
    }

    return () => {
      if (process.env.NODE_ENV === "test") {
        posthog.reset();
        window.__posthogInitialized = false;
      }
    };
  }, []);

  return null;
}
