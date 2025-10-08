// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Flex, Loader, Text } from "@vibe/core";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./callback.module.css";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirectParam = sp.get("redirectTo");
  const normalizedRedirect = redirectParam?.startsWith("/") ? redirectParam : "/dashboard";

  const hasEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const supabase = useMemo(() => (hasEnv ? createSupabaseBrowserClient() : null), [hasEnv]);

  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [message, setMessage] = useState("Conectando à sua conta...");

  useEffect(() => {
    if (!supabase) {
      if (!hasEnv) { setStatus("error"); setMessage("Variáveis de ambiente do Supabase não configuradas."); }
      return;
    }
    let mounted = true;

    const run = async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const qp = url.searchParams;

      const err =
        hash.get("error_description") || hash.get("error") || qp.get("error_description") || qp.get("error");
      if (err) { setStatus("error"); setMessage(err); return; }

      // 1) Prefer cross-device safe MAGIC LINK: token_hash
      const token_hash = qp.get("token_hash") || hash.get("token_hash");
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
        if (!mounted) return;
        if (!error) {
          setStatus("success"); setMessage("Tudo pronto! Redirecionando...");
          router.replace(normalizedRedirect); return;
        }
        setStatus("error"); setMessage(error.message); return;
      }

      // 2) Fallback: implicit tokens in URL
      const at = hash.get("access_token") || qp.get("access_token");
      const rt = hash.get("refresh_token") || qp.get("refresh_token");
      if (at && rt) {
        const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
        if (!mounted) return;
        if (!error) {
          setStatus("success"); setMessage("Tudo pronto! Redirecionando...");
          router.replace(normalizedRedirect); return;
        }
        setStatus("error"); setMessage(error.message); return;
      }

      // 3) Last resort: PKCE code exchange (requires same-tab verifier)
      const code = qp.get("code") || hash.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (!mounted) return;
        if (!error) {
          setStatus("success"); setMessage("Tudo pronto! Redirecionando...");
          router.replace(normalizedRedirect); return;
        }
        setStatus("error"); setMessage(error.message); return;
      }

      setStatus("error"); setMessage("Não foi possível validar o link de autenticação.");
    };

    // Defensive: clear stale pkce verifier so future attempts won’t conflict
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-pkce-code-verifier-"))
      .forEach((k) => localStorage.removeItem(k));

    void run();
    return () => { mounted = false; };
  }, [supabase, router, normalizedRedirect, hasEnv]);

  const back = () => router.replace(`/sign-in?redirectTo=${encodeURIComponent(normalizedRedirect)}`);

  return (
    <main className={styles.root}>
      <section className={styles.panel} aria-live="polite">
        <div className={styles.message}>
          {status === "loading" ? <Loader size={Loader.sizes.SMALL} /> : null}
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            {status === "success" ? "Login confirmado" : status === "error" ? "Falha na autenticação" : "Validando link"}
          </Text>
          <Text
            type={Text.types.TEXT3}
            color={status === "error" ? Text.colors.NEGATIVE : Text.colors.SECONDARY}
            className={status === "error" ? styles.errorText : undefined}
          >
            {message}
          </Text>
        </div>

        {status === "error" ? (
          <Flex justify={Flex.justify.CENTER}>
            <Button kind={Button.kinds.PRIMARY} type={Button.types.BUTTON} onClick={back}>
              Voltar para o login
            </Button>
          </Flex>
        ) : null}
      </section>
    </main>
  );
}
