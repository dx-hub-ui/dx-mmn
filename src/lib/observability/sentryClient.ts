"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

type ScopeTags = {
  orgId?: string | null;
  sequenceId?: string | null;
  versionId?: string | null;
  targetType?: string | null;
  enrollmentId?: string | null;
};

type BreadcrumbPayload = {
  message: string;
  data?: Record<string, unknown>;
};

export function useSentrySequenceScope(tags: ScopeTags, breadcrumb?: BreadcrumbPayload) {
  useEffect(() => {
    try {
      Sentry.configureScope((scope) => {
        if (tags.orgId) scope.setTag("org_id", tags.orgId);
        if (tags.sequenceId) scope.setTag("sequence_id", tags.sequenceId);
        if (tags.versionId) scope.setTag("version_id", tags.versionId);
        if (tags.targetType) scope.setTag("target_type", tags.targetType);
        if (tags.enrollmentId) scope.setTag("enrollment_id", tags.enrollmentId);
      });

      if (breadcrumb) {
        Sentry.addBreadcrumb({
          category: "sequence",
          level: "info",
          message: breadcrumb.message,
          data: breadcrumb.data,
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[sentry] escopo não configurado", error);
      }
    }
  }, [breadcrumb, tags.enrollmentId, tags.orgId, tags.sequenceId, tags.targetType, tags.versionId]);
}
