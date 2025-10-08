import * as Sentry from "@sentry/nextjs";

type ScopeTags = {
  orgId?: string | null;
  sequenceId?: string | null;
  versionId?: string | null;
  targetType?: string | null;
  enrollmentId?: string | null;
  assignmentId?: string | null;
};

type BreadcrumbPayload = {
  message: string;
  data?: Record<string, unknown>;
};

export function captureSequenceServerBreadcrumb(tags: ScopeTags, breadcrumb: BreadcrumbPayload) {
  try {
    Sentry.configureScope((scope) => {
      if (tags.orgId) scope.setTag("org_id", tags.orgId);
      if (tags.sequenceId) scope.setTag("sequence_id", tags.sequenceId);
      if (tags.versionId) scope.setTag("version_id", tags.versionId);
      if (tags.targetType) scope.setTag("target_type", tags.targetType);
      if (tags.enrollmentId) scope.setTag("enrollment_id", tags.enrollmentId);
      if (tags.assignmentId) scope.setTag("assignment_id", tags.assignmentId);

      scope.addBreadcrumb({
        category: "sequence",
        level: "info",
        message: breadcrumb.message,
        data: breadcrumb.data,
      });
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[sentry] escopo de servidor não configurado", error);
    }
  }
}
