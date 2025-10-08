// src/app/sign-in/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Flex, Loader, Text } from "@vibe/core";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./sign-in.module.css";

export default function SignInPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => {
    const raw = searchParams.get("redirectTo");
    return raw && raw.startsWith("/") ? raw : "/dashboard";
  }, [searchParams]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let redirected = false;

    const redirectAuthenticatedUser = () => {
      if (!active || redirected) return;
      redirected = true;
      setStatus("loading");
      setMsg("Redirecionando...");
      router.replace(redirectTo);
    };

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.warn("Falha ao recuperar sessão persistida", error.message);
        return;
      }

      if (data.session?.user) {
        redirectAuthenticatedUser();
      }
    };

    checkSession();

    const { data: authListener, error: listenerError } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        redirectAuthenticatedUser();
      }
    });

    if (listenerError) {
      console.warn("Falha ao observar mudanças de sessão", listenerError.message);
    }

    return () => {
      active = false;
      authListener?.subscription.unsubscribe();
    };
  }, [redirectTo, router, supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMsg(null);

    const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin).replace(/\/$/, "");
    const emailRedirectTo = `${origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });

    if (error) {
      setStatus("error");
      setMsg(error.message);
      return;
    }
    setStatus("sent");
    setMsg("Link enviado. Abra o e-mail.");
  };

  return (
    <main className={styles.root}>
      <section className={styles.panel} aria-live="polite">
        <div className={styles.message}>
          {status === "loading" ? <Loader size={Loader.sizes.SMALL} /> : null}
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            {status === "sent" ? "Verifique seu e-mail" : "Entrar na plataforma"}
          </Text>
          {msg ? (
            <Text type={Text.types.TEXT3} color={status === "error" ? Text.colors.NEGATIVE : Text.colors.SECONDARY}>
              {msg}
            </Text>
          ) : null}
        </div>

        {status !== "sent" ? (
          <form onSubmit={onSubmit} className={styles.form}>
            <label htmlFor="email" className={styles.label}>Email *</label>
            <input
              id="email" type="email" required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              autoComplete="email"
              inputMode="email"
              disabled={status === "loading"}
            />
            <Flex justify={Flex.justify.CENTER} gap={8}>
              <Button kind={Button.kinds.PRIMARY} type={Button.types.SUBMIT} disabled={!email || status === "loading"}>
                Enviar link
              </Button>
            </Flex>
          </form>
        ) : null}
      </section>
    </main>
  );
}
