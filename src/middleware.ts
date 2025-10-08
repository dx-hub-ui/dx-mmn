// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/auth/") || pathname === "/sign-in" || pathname === "/") {
    return NextResponse.next();
  }

  const response = NextResponse.next();

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
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const to = req.nextUrl.clone();
    to.pathname = "/sign-in";
    to.search = "";
    to.searchParams.set("redirectTo", pathname + (search || "") || "/dashboard");

    const redirectResponse = NextResponse.redirect(to);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/tables/:path*", "/app/:path*"],
};
