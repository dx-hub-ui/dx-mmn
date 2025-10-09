import { captureException } from "@sentry/nextjs";
import { ensureRequestId, getRequestContext } from "../request-context";
import { trackServerEvent } from "../analytics/track";

export type InstrumentedFetchOptions = RequestInit & {
  capture?: boolean;
};

export async function instrumentedFetch(input: RequestInfo | URL, init?: InstrumentedFetchOptions) {
  const context = getRequestContext();
  const requestId = context?.requestId ?? ensureRequestId(init?.headers ?? null);
  const headers = new Headers(init?.headers || {});
  headers.set("x-request-id", requestId);

  try {
    const response = await fetch(input as RequestInfo, {
      ...init,
      headers,
    });

    if (!response.ok && init?.capture !== false) {
      const payload = {
        status: "error" as const,
        url: typeof input === "string" ? input : "url" in (input as Request) ? (input as Request).url : String(input),
        method: init?.method || (input instanceof Request ? input.method : undefined),
        request_id: requestId,
        message: response.statusText,
        status_code: response.status,
      };
      captureException(new Error(`Request failed: ${payload.status_code} ${payload.url}`), {
        contexts: {
          request: payload,
        },
      });
      trackServerEvent("api_request_failed", payload).catch(() => undefined);
    }

    return response;
  } catch (error) {
    if (init?.capture !== false) {
      captureException(error);
      trackServerEvent("api_request_failed", {
        url: typeof input === "string" ? input : input instanceof Request ? input.url : String(input),
        method: init?.method || (input instanceof Request ? input.method : undefined),
        request_id: requestId,
        status: "error",
      }).catch(() => undefined);
    }
    throw error;
  }
}
