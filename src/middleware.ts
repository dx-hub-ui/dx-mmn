// middleware.ts — proteja só telas de app; não intercepte "/" nem "/auth/*" nem "/sign-in"
import { NextRequest, NextResponse } from "next/server";

async function validate(token: string, url: string, anon: string) {
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
    cache: "no-store",
  });
  if (r.ok) return true;
  if (r.status === 401 || r.status === 403) return false;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/auth/") || pathname === "/sign-in" || pathname === "/") {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const token = req.cookies.get("sb-access-token")?.value;

  if (!token || !(await validate(token, url, anon))) {
    const to = req.nextUrl.clone();
    to.pathname = "/sign-in";
    to.search = "";
    to.searchParams.set("redirectTo", pathname + search || "/dashboard");
    return NextResponse.redirect(to);
  }

  return NextResponse.next();
}

// src/app/(app)/dashboard → path é /dashboard
export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/tables/:path*", "/app/:path*"],
};
