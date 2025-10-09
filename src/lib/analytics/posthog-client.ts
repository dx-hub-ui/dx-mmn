"use client";

import { useEffect, useState } from "react";
import { getPosthogBrowserClient } from "./posthog-browser";

export function usePostHogFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let unsub: (() => void) | undefined;
    getPosthogBrowserClient()
      .then((client) => {
        if (!client) {
          return;
        }
        const updateFlags = () => {
          const currentFlags = ((client as unknown as { getFeatureFlags?: () => string[] }).getFeatureFlags?.() ?? []) as string[];
          const mapped: Record<string, boolean> = {};
          currentFlags.forEach((flag: string) => {
            mapped[flag] = client.isFeatureEnabled(flag) ?? false;
          });
          setFlags(mapped);
        };
        updateFlags();
        unsub = client.onFeatureFlags(updateFlags);
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[posthog] Failed to initialise feature flags", error);
        }
      });

    return () => {
      if (typeof unsub === "function") {
        unsub();
      }
    };
  }, []);

  return flags;
}
