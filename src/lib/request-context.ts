import { randomUUID } from "crypto";

type RequestContextValue = {
  requestId: string;
  userId?: string | null;
  orgId?: string | null;
  ipAddress?: string | null;
};

type PartialContext = Partial<Omit<RequestContextValue, "requestId">> & {
  requestId?: string;
};

let storage: import("node:async_hooks").AsyncLocalStorage<RequestContextValue> | null = null;

if (typeof window === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AsyncLocalStorage } = require("node:async_hooks") as typeof import("node:async_hooks");
  storage = new AsyncLocalStorage<RequestContextValue>();
}

declare global {
  interface Window {
    __requestContext?: RequestContextValue;
  }
}

function applyToSentryScope(context: RequestContextValue) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nextjs") as typeof import("@sentry/nextjs");
    Sentry.configureScope((scope) => {
      scope.setTag("request_id", context.requestId);
      if (context.orgId) {
        scope.setTag("org_id", context.orgId);
      }
      if (context.userId) {
        scope.setUser({ id: context.userId || undefined });
      }
    });
  } catch {
    // ignore - sentry not loaded
  }
}

export function createRequestId() {
  return randomUUID();
}

export function ensureRequestId(headers?: Headers | HeadersInit | Record<string, string | undefined> | null) {
  if (!headers) {
    return createRequestId();
  }

  if (headers instanceof Headers) {
    return headers.get("x-request-id") || createRequestId();
  }

  if (Array.isArray(headers)) {
    const map = new Map(headers);
    return map.get("x-request-id") ?? createRequestId();
  }

  const headerValue = headers["x-request-id"];
  return headerValue || createRequestId();
}

export function runWithRequestContext<T>(context: PartialContext, callback: () => T): T {
  const requestContext: RequestContextValue = {
    requestId: context.requestId ?? createRequestId(),
    userId: context.userId ?? null,
    orgId: context.orgId ?? null,
    ipAddress: context.ipAddress ?? null,
  };

  if (storage) {
    applyToSentryScope(requestContext);
    return storage.run(requestContext, callback);
  }

  return callback();
}

export function setServerRequestContext(context: PartialContext) {
  if (!storage) {
    return;
  }

  const current = storage.getStore();
  const next: RequestContextValue = {
    requestId: context.requestId ?? current?.requestId ?? createRequestId(),
    userId: context.userId ?? current?.userId ?? null,
    orgId: context.orgId ?? current?.orgId ?? null,
    ipAddress: context.ipAddress ?? current?.ipAddress ?? null,
  };

  storage.enterWith(next);
  applyToSentryScope(next);
}

export function getRequestContext(): RequestContextValue | undefined {
  if (typeof window !== "undefined") {
    return window.__requestContext;
  }

  return storage?.getStore();
}

export function setClientRequestContext(context: RequestContextValue) {
  if (typeof window === "undefined") {
    return;
  }
  window.__requestContext = context;
}

export function getRequestId() {
  return getRequestContext()?.requestId;
}
