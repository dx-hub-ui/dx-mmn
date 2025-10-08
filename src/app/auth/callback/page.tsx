// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const sp = useSearchParams();
  const redirectTo = sp.get("redirectTo")?.startsWith("/") ? sp.get("redirectTo")! : "/dashboard";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const run = async () => {
      // detectSessionInUrl=true fará a troca code→session automaticamente
      await supabase.auth.getSession();
      // redireção dura para evitar corrida com middleware
      window.location.replace(redirectTo);
    };
    run();
  }, [redirectTo, supabase]);

  return null;
}
