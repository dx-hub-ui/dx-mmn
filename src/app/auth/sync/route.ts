// src/app/auth/sync/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  const { access_token, refresh_token } = await req.json().catch(() => ({}));
  if (!access_token || !refresh_token) {
    return new NextResponse("Tokens ausentes", { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Use o shape de objeto (CookieMethodsServerDeprecated)
      cookies: {
        get() {
          return undefined; // não precisamos ler cookies aqui
        },
        set(name, value, options) {
          res.cookies.set({
            name,
            value,
            ...options,
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: true,
          });
        },
        remove(name, options) {
          res.cookies.set({
            name,
            value: "",
            ...options,
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: true,
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) return new NextResponse(error.message, { status: 400 });

  return res;
}
