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
    let cancelled = false;

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const searchParams = url.searchParams;
        const hashParams = new URLSearchParams(url.hash.slice(1));

        const errorDescription = searchParams.get("error_description") ?? hashParams.get("error_description");
        if (errorDescription) {
          if (!cancelled) setErr(errorDescription);
          return;
        }

        await supabase.auth.initialize().catch((initError) => {
          console.error("Supabase auth initialization failed", initError);
        });

        let {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          if (!cancelled) setErr(sessionError.message);
          return;
        }

        const safeSetSession = (maybeSession: typeof session) => {
          if (maybeSession) {
            session = maybeSession;
          }
        };

        if (!session) {
          const code = searchParams.get("code") ?? hashParams.get("code");
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              const message = error.message ?? "Falha ao validar código.";
              if (/code verifier/i.test(message) || /invalid request/i.test(message)) {
                console.warn("Supabase PKCE fallback:", message);
              } else {
                if (!cancelled) setErr(message);
                return;
              }
            } else {
              safeSetSession(data.session);
            }
          }
        }

        if (!session) {
          const token_hash = searchParams.get("token_hash") ?? hashParams.get("token_hash");
          if (token_hash) {
            const typeParam = searchParams.get("type") ?? hashParams.get("type") ?? "magiclink";
            const emailParam = searchParams.get("email") ?? hashParams.get("email") ?? undefined;
            const verifyPayload: Parameters<typeof supabase.auth.verifyOtp>[0] = {
              type: typeParam as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
              token_hash,
            } as Parameters<typeof supabase.auth.verifyOtp>[0];
            if (emailParam) {
              (verifyPayload as { email?: string }).email = emailParam;
            }
            const { data, error } = await supabase.auth.verifyOtp(verifyPayload);
            if (error) {
              if (!cancelled) setErr(error.message);
              return;
            }
            safeSetSession(data.session);
          }
        }

        if (!session) {
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              if (!cancelled) setErr(error.message);
              return;
            }
            safeSetSession(data.session);
          }
        }

        if (!session) {
          if (!cancelled) setErr("Link inválido ou expirado.");
          return;
        }

        const at = session.access_token;
        const rt = session.refresh_token;
        if (!at || !rt) {
          if (!cancelled) setErr("Link inválido ou expirado.");
          return;
        }

        const syncResponse = await fetch("/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: at, refresh_token: rt }),
          cache: "no-store",
        });

        if (!syncResponse.ok) {
          const bodyText = await syncResponse.text().catch(() => "Falha ao sincronizar.");
          if (!cancelled) setErr(bodyText || "Falha ao sincronizar.");
          return;
        }

        const cleanUrl = new URL(window.location.href);
        cleanUrl.hash = "";
        cleanUrl.search = "";
        cleanUrl.searchParams.set("redirectTo", redirectTo);
        window.history.replaceState({}, "", cleanUrl.toString());

        window.location.replace(redirectTo);
      } catch (error) {
        console.error("Erro ao processar callback de autenticação", error);
        const message = error instanceof Error ? error.message : "Erro desconhecido.";
        if (!cancelled) setErr(message);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [redirectTo, supabase]);

  return err ? <pre style={{ padding: 16 }}>Erro de autenticação: {err}</pre> : null;
}
