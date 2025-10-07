import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables");
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options?: Record<string, unknown>) {
        response.cookies.set({ name, value, ...(options ?? {}) });
      },
      remove(name: string, options?: Record<string, unknown>) {
        response.cookies.set({ name, value: "", ...(options ?? {}), expires: new Date(0) });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*"],
};
