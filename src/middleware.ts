// middleware.ts — production, magic-link only (no PKCE), protects app routes
import { NextRequest, NextResponse } from "next/server";

async function validateSession(accessToken: string, supabaseUrl: string, supabaseAnonKey: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 3000);

  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      cache: "no-store",
      signal: ctl.signal,
    });

    if (r.ok) return true;
    if (r.status === 401 || r.status === 403) return false;

    // Fail closed on unexpected statuses in prod
    return false;
  } catch {
    // Network/timeouts → fail closed
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Never touch auth callback or sign-in
  if (pathname.startsWith("/auth/") || pathname === "/sign-in") {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // Hard fail in prod if env is missing
    return new NextResponse("Missing Supabase env", { status: 500 });
  }

  const accessToken = request.cookies.get("sb-access-token")?.value;
  if (!accessToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.search = ""; // reset then set redirectTo cleanly
    redirectUrl.searchParams.set("redirectTo", pathname + search);
    return NextResponse.redirect(redirectUrl);
  }

  const ok = await validateSession(accessToken, supabaseUrl, supabaseAnonKey);
  if (!ok) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("redirectTo", pathname + search);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

// Protect only your app surfaces. Exclude static assets and public endpoints.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/tables/:path*",
    "/app/:path*",
    // global exclude list
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|auth/.*|sign-in).*)",
  ],
};
