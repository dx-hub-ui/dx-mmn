// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import * as Sentry from "@sentry/nextjs";

export async function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  const requestId = headers.get("x-request-id") ?? crypto.randomUUID();
  headers.set("x-request-id", requestId);
  Sentry.configureScope((scope: any) => {
    scope.setTag("request_id", requestId);
    scope.setTransactionName(req.nextUrl.pathname);
  });

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/auth/") || pathname === "/sign-in" || pathname === "/") {
    const response = NextResponse.next({
      request: {
        headers,
      },
    });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.next({
    request: {
      headers,
    },
  });
  response.headers.set("x-request-id", requestId);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set({
            name,
            value,
            ...options,
            path: options?.path ?? "/",
            sameSite: options?.sameSite ?? "lax",
          });
        },
        remove(name, options) {
          response.cookies.set({
            name,
            value: "",
            ...options,
            path: options?.path ?? "/",
            sameSite: options?.sameSite ?? "lax",
          });
        },
      },
    }
  );

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let resolvedSession = session ?? null;

  if (!resolvedSession) {
    const { data, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) {
      resolvedSession = data.session;
    }
  }

  let user = resolvedSession?.user ?? null;
  let authError = sessionError ?? null;

  if (!user) {
    const {
      data: { user: fetchedUser },
      error: fetchUserError,
    } = await supabase.auth.getUser();
    authError = authError ?? fetchUserError ?? null;
    user = fetchedUser ?? null;
  }

  if (authError && !user) {
    console.warn("Supabase auth error in middleware", authError.message ?? authError.name ?? "unknown error");
  }

  if (!user) {
    const to = req.nextUrl.clone();
    to.pathname = "/sign-in";
    to.search = "";
    to.searchParams.set("redirectTo", pathname + (search || "") || "/dashboard");

    const redirectResponse = NextResponse.redirect(to);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    redirectResponse.headers.set("x-request-id", requestId);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/tables/:path*", "/app/:path*"],
};
