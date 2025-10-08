// src/app/auth/callback/route.ts  (Route Handler recommended for PKCE)
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get("redirectTo") || "/dashboard";

  const supabase = createSupabaseServerClient();

  // Exchange the auth code for a session and set cookies.
  // For PKCE magic links, this must run before any redirect.
  const { error } = await supabase.auth.exchangeCodeForSession(url);

  // Optional: strip auth params from URL
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("token_hash"); // if present

  if (error) {
    // Send to sign-in with error
    const back = new URL("/sign-in", url.origin);
    back.searchParams.set("redirectTo", redirectTo);
    back.searchParams.set("error", error.message);
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
