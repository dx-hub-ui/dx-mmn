// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const sp = useSearchParams();
  const redirectTo = "/dashboard";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      // 1) PKCE: troca code→session no cliente
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (exErr) { setErr(exErr.message); return; }

      // 2) Obter tokens atuais do cliente
      const { data } = await supabase.auth.getSession();
      const at = data.session?.access_token;
      const rt = data.session?.refresh_token;
      if (!at || !rt) { setErr("Sessão ausente após login."); return; }

      // 3) Sincronizar cookies no servidor
      const r = await fetch("/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: at, refresh_token: rt }),
        cache: "no-store",
      });
      if (!r.ok) {
        const msg = await r.text().catch(() => "Falha ao sincronizar sessão.");
        setErr(msg || "Falha ao sincronizar sessão.");
        return;
      }

      // 4) Redireciono só após cookies escritos
      window.location.replace(redirectTo);
    };
    run();
  }, [supabase]);

  return err ? <pre style={{ padding: 16 }}>Erro de autenticação: {err}</pre> : null;
}
