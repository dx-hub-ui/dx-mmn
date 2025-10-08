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
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "undefined";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "undefined";
    console.log("[callback] env", {
      hasEnv,
      supabaseUrlHost: (() => {
        try { return new URL(url).host; } catch { return "invalid-url"; }
      })(),
      anonPrefix: anon?.slice(0, 8),
    });
    return hasEnv ? createSupabaseBrowserClient() : null;
  }, [hasEnv]);

  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [message, setMessage] = useState("Conectando à sua conta...");

  useEffect(() => {
    if (!supabase) {
      if (!hasEnv) {
        setStatus("error");
        setMessage("Variáveis de ambiente do Supabase não configuradas.");
        console.error("[callback] no supabase client");
      }
      return;
    }
    let mounted = true;

    const run = async () => {
      const href = window.location.href;
      const url = new URL(href);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const qp = url.searchParams;

      const paramsSnapshot = {
        href,
        query: Object.fromEntries(qp.entries()),
        hash: Object.fromEntries(hash.entries()),
      };
      console.log("[callback] url params", paramsSnapshot);

      const pkceKeys = Object.keys(localStorage).filter((k) => k.startsWith("sb-pkce-code-verifier-"));
      console.log("[callback] pkce keys present", { count: pkceKeys.length, keys: pkceKeys.slice(0, 5) });

      const err =
        hash.get("error_description") || hash.get("error") || qp.get("error_description") || qp.get("error");
      if (err) {
        setStatus("error");
        setMessage(err);
        console.error("[callback] error params", { err });
        return;
      }

      // 1) token_hash first
      const token_hash = qp.get("token_hash") || hash.get("token_hash");
      if (token_hash) {
        console.log("[callback] flow", { chosen: "token_hash" });
        const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
        if (!mounted) return;
        if (!error) {
          setStatus("success"); setMessage("Tudo pronto! Redirecionando...");
          console.log("[callback] verifyOtp success");
          router.replace(normalizedRedirect); return;
        }
        setStatus("error"); setMessage(error.message);
        console.error("[callback] verifyOtp error", { message: error.message, name: error.name });
        return;
      }

      // 2) implicit tokens
      const at = hash.get("access_token") || qp.get("access_token");
      const rt = hash.get("refresh_token") || qp.get("refresh_token");
      if (at && rt) {
        console.log("[callback] flow", {
          chosen: "implicit",
          accessLen: at.length,
          refreshLen: rt.length,
        });
        const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
        if (!mounted) return;
        if (!error) {
          setStatus("success"); setMessage("Tudo pronto! Redirecionando...");
          console.log("[callback] setSession success");
          router.replace(normalizedRedirect); return;
        }
        setStatus("error"); setMessage(error.message);
        console.error("[callback] setSession error", { message: error.message, name: error.name });
        return;
      }

      // 3) PKCE last
      const code = qp.get("code") || hash.get("code");
      if (code) {
        console.log("[callback] flow", { chosen: "pkce", codeLen: code.length });
        const { error } = await supabase.auth.exchangeCodeForSession(href);
        if (!mounted) return;
        if (!error) {
          setStatus("success"); setMessage("Tudo pronto! Redirecionando...");
          console.log("[callback] exchangeCodeForSession success");
          router.replace(normalizedRedirect); return;
        }
        setStatus("error"); setMessage(error.message);
        console.error("[callback] exchangeCodeForSession error", { message: error.message, name: error.name });
        return;
      }

      setStatus("error");
      setMessage("Não foi possível validar o link de autenticação.");
      console.error("[callback] no known auth params found");
    };

    void run();
    return () => { mounted = false; };
  }, [supabase, router, normalizedRedirect, hasEnv]);

  const back = () => {
    console.log("[callback] back to sign-in");
    router.replace(`/sign-in?redirectTo=${encodeURIComponent(normalizedRedirect)}`);
  };

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
