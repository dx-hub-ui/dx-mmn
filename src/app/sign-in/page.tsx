// src/app/sign-in/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Flex, Loader, Text } from "@vibe/core";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./sign-in.module.css";

export default function SignInPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirectParam = sp.get("redirectTo");
  const normalizedRedirect = redirectParam?.startsWith("/") ? redirectParam : "/dashboard";

  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabase = useMemo(() => (hasEnv ? createSupabaseBrowserClient() : null), [hasEnv]);

  type Status = "idle" | "loading" | "sent" | "error";
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [cooldown, setCooldown] = useState(0); // seconds
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "sent") return;
    setCooldown(45); // resend after 45s
    timerRef.current = window.setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000) as unknown as number;
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [status]);

  const sendLink = async () => {
    if (!supabase) {
      setStatus("error");
      setMessage("Variáveis de ambiente do Supabase não configuradas.");
      return;
    }
    setStatus("loading");
    setMessage(null);

    const emailRedirectTo = `https://app.dxhub.com.br/auth/callback?redirectTo=${encodeURIComponent(
      normalizedRedirect
    )}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
    setMessage("Enviamos um link mágico para o seu e-mail. Abra o link para continuar.");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendLink();
  };

  const resend = async () => {
    if (cooldown > 0) return;
    await sendLink();
  };

  const changeEmail = () => {
    setStatus("idle");
    setMessage(null);
    setCooldown(0);
  };

  const goHome = () => router.replace("/");

  return (
    <main className={styles.root}>
      <section className={styles.panel} aria-live="polite">
        <div className={styles.message}>
          {(status === "loading") ? <Loader size={Loader.sizes.SMALL} /> : null}
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            {status === "sent" ? "Verifique seu e-mail" : "Entrar na plataforma"}
          </Text>
          {message ? (
            <Text
              type={Text.types.TEXT3}
              color={status === "error" ? Text.colors.NEGATIVE : Text.colors.SECONDARY}
              className={status === "error" ? styles.errorText : undefined}
            >
              {message}
            </Text>
          ) : (
            <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
              Use o e-mail cadastrado para receber um link mágico de acesso.
            </Text>
          )}
        </div>

        {status !== "sent" ? (
          <form onSubmit={onSubmit} className={styles.form}>
            <label htmlFor="email" className={styles.label}>Email *</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
              disabled={status === "loading"}
            />
            <Flex justify={Flex.justify.CENTER} gap={8}>
              <Button kind={Button.kinds.PRIMARY} type={Button.types.SUBMIT} disabled={status === "loading" || !email}>
                Enviar link de acesso
              </Button>
              <Button kind={Button.kinds.SECONDARY} type={Button.types.BUTTON} onClick={goHome}>
                Voltar para a home
              </Button>
            </Flex>
          </form>
        ) : (
          <Flex direction={Flex.directions.COLUMN} gap={8} className={styles.actions}>
            <Button
              kind={Button.kinds.PRIMARY}
              type={Button.types.BUTTON}
              onClick={resend}
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar link"}
            </Button>
            <Button kind={Button.kinds.TERTIARY} type={Button.types.BUTTON} onClick={changeEmail}>
              Usar outro e-mail
            </Button>
            <Button
              kind={Button.kinds.SECONDARY}
              type={Button.types.BUTTON}
              onClick={() =>
                router.replace(`/auth/callback?redirectTo=${encodeURIComponent(normalizedRedirect)}`)
              }
            >
              Já tenho o link aberto
            </Button>
          </Flex>
        )}

        <Text type={Text.types.TEXT4} color={Text.colors.SECONDARY} className={styles.footerNote}>
          Após confirmar o login, você será direcionado para {normalizedRedirect}.
        </Text>
      </section>
    </main>
  );
}
