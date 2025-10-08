// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirectTo = sp.get("redirectTo")?.startsWith("/") ? sp.get("redirectTo")! : "/dashboard";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const run = async () => {
      // implicit: detectSessionInUrl=true will parse #access_token and set cookies
      await supabase.auth.getSession();

      // also support token_hash emails (verifyOtp)
      const href = window.location.href;
      const u = new URL(href);
      const hash = new URLSearchParams(location.hash.slice(1));
      const token_hash = u.searchParams.get("token_hash") || hash.get("token_hash");
      if (token_hash) {
        await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
      }

      router.replace(redirectTo);
    };
    run();
  }, [router, redirectTo, supabase]);

  return null;
}
