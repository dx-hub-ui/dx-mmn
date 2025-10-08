// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const sp = useSearchParams();
  const redirectTo = sp.get("redirectTo")?.startsWith("/") ? sp.get("redirectTo")! : "/dashboard";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);

      const errorDescription = url.searchParams.get("error_description");
      if (errorDescription) {
        setErr(errorDescription);
        return;
      }

      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession({ code });
        if (error) {
          setErr(error.message);
          return;
        }
      } else {
        // 1) implicit: detectSessionInUrl=true salva sessão se veio #access_token
        await supabase.auth.getSession();
      }

      // 2) fallback token_hash (alguns templates enviam magic link assim)
      const hash = new URLSearchParams(location.hash.slice(1));
      const token_hash = url.searchParams.get("token_hash") || hash.get("token_hash");
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
        if (error) { setErr(error.message); return; }
      }

      // 3) sincroniza cookies HTTP-only p/ middleware
      const { data } = await supabase.auth.getSession();
      const at = data.session?.access_token;
      const rt = data.session?.refresh_token;
      if (!at || !rt) { setErr("Link inválido."); return; }

      const r = await fetch("/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: at, refresh_token: rt }),
        cache: "no-store",
      });
      if (!r.ok) { setErr(await r.text().catch(()=> "Falha ao sincronizar.")); return; }

      window.location.replace(redirectTo);
    };
    run();
  }, [redirectTo, supabase]);

  return err ? <pre style={{ padding: 16 }}>Erro de autenticação: {err}</pre> : null;
}
