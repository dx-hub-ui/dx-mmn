import { NextRequest, NextResponse } from "next/server";

async function validateSession(accessToken: string, supabaseUrl: string, supabaseAnonKey: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return true;
  }

  if (response.status === 401 || response.status === 403) {
    return false;
  }

  throw new Error(`Unexpected response when validating Supabase session: ${response.status}`);
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables");
  }

  const accessToken = request.cookies.get("sb-access-token")?.value;

  if (!accessToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  const isValid = await validateSession(accessToken, supabaseUrl, supabaseAnonKey);

  if (!isValid) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|auth/.*|sign-in).*)",
  ],
};
