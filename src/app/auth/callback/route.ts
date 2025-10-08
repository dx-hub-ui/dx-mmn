// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get("redirectTo") || "/dashboard";

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          // no read on first hit; cookies are set during exchange
          return undefined;
        },
        set(name, value, options) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // PKCE magic link: exchange ?code=... for a session and set sb-* cookies.
  const { error } = await supabase.auth.exchangeCodeForSession(url);

  // Clean URL
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("token_hash");

  if (error) {
    const back = new URL("/sign-in", url.origin);
    back.searchParams.set("redirectTo", redirectTo);
    back.searchParams.set("error", error.message);
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
