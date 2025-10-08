// src/app/auth/callback/page.tsx — set session, then hard-redirect to /dashboard
"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const sp = useSearchParams();
  const DEFAULT = "/dashboard";
  const redirectTo = sp.get("redirectTo")?.startsWith("/") ? sp.get("redirectTo")! : DEFAULT;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const href = window.location.href;
      const u = new URL(href);
      const hash = new URLSearchParams(location.hash.slice(1));

      const token_hash = u.searchParams.get("token_hash") || hash.get("token_hash");
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
        if (error) { setErr(error.message); return; }
        window.location.replace(redirectTo); return;
      }

      const access_token = u.searchParams.get("access_token") || hash.get("access_token");
      const refresh_token = u.searchParams.get("refresh_token") || hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) { setErr(error.message); return; }
        window.location.replace(redirectTo); return;
      }

      setErr("Link inválido.");
    };
    run();
  }, [redirectTo, supabase]);

  return err ? <pre style={{ padding: 16 }}>Erro de autenticação: {err}</pre> : null;
}
