"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { getPosthogBrowserClient } from "@/lib/analytics/posthog-browser";
import { usePostHogFeatureFlags } from "@/lib/analytics/posthog-client";
import { trackClientEvent } from "@/lib/analytics/track";
import { setClientRequestContext } from "@/lib/request-context";

export type ClientObservabilityContext = {
  requestId?: string;
  userId?: string | null;
  orgId?: string | null;
};

const FeatureFlagContext = createContext<Record<string, boolean>>({});

export function useFeatureFlag(flagKey: string, fallback = false) {
  const flags = useContext(FeatureFlagContext);
  return flags[flagKey] ?? fallback;
}

type Props = {
  children: ReactNode;
  context?: ClientObservabilityContext;
};

export function ObservabilityProvider({ children, context }: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const flags = usePostHogFeatureFlags();
  const lastPathRef = useRef<string | null>(null);
  const [isBootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!context) {
      return;
    }
    setClientRequestContext({
      requestId: context.requestId ?? "browser",
      orgId: context.orgId ?? null,
      userId: context.userId ?? null,
      ipAddress: null,
    });
    Sentry.configureScope((scope) => {
      if (context.requestId) {
        scope.setTag("request_id", context.requestId);
      }
      if (context.orgId) {
        scope.setTag("org_id", context.orgId);
      }
      if (context.userId) {
        scope.setUser({ id: context.userId ?? undefined });
      }
    });
  }, [context]);

  useEffect(() => {
    getPosthogBrowserClient().then((client) => {
      if (!client) {
        return;
      }
      setBootstrapped(true);
      if (typeof window !== "undefined") {
        client.capture("$pageview");
      }
    });
  }, []);

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }
    const nextPath = `${pathname}${search?.toString() ? `?${search?.toString()}` : ""}`;
    if (lastPathRef.current === nextPath) {
      return;
    }
    lastPathRef.current = nextPath;
    getPosthogBrowserClient().then((client) => {
      if (!client) {
        return;
      }
      client.capture("$pageview", {
        $current_url: typeof window !== "undefined" ? window.location.href : nextPath,
        request_id: context?.requestId,
      });
    });
  }, [context?.requestId, isBootstrapped, pathname, search]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleError = (event: ErrorEvent) => {
      trackClientEvent("errors:client_runtime", {
        message: event.message,
        request_id: context?.requestId,
        user_id: context?.userId ?? undefined,
      }).catch(() => undefined);
    };

    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("error", handleError);
    };
  }, [context?.requestId, context?.userId]);

  const memoizedFlags = useMemo(() => flags, [flags]);

  return <FeatureFlagContext.Provider value={memoizedFlags}>{children}</FeatureFlagContext.Provider>;
}
