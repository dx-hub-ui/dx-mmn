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

      const hashParams = new URLSearchParams(url.hash.slice(1));

      await supabase.auth.initialize().catch((initError) => {
        console.error("Supabase auth initialization failed", initError);
      });

      let {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) {
        setErr(sessionError.message);
        return;
      }

      if (!session) {
        const token_hash = url.searchParams.get("token_hash") ?? hashParams.get("token_hash");
        if (token_hash) {
          const typeParam = url.searchParams.get("type") ?? hashParams.get("type") ?? "magiclink";
          const emailParam = url.searchParams.get("email") ?? hashParams.get("email") ?? undefined;
          const verifyPayload: Parameters<typeof supabase.auth.verifyOtp>[0] = {
            type: typeParam as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
            token_hash,
          } as Parameters<typeof supabase.auth.verifyOtp>[0];
          if (emailParam) {
            (verifyPayload as { email?: string }).email = emailParam;
          }
          const { data, error } = await supabase.auth.verifyOtp(verifyPayload);
          if (error) {
            setErr(error.message);
            return;
          }
          session = data.session;
        }
      }

      if (!session) {
        setErr("Link inválido ou expirado.");
        return;
      }

      const at = session.access_token;
      const rt = session.refresh_token;
      if (!at || !rt) {
        setErr("Link inválido ou expirado.");
        return;
      }

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
