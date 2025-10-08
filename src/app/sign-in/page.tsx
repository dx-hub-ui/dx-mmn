// src/app/sign-in/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Flex, Loader, Text } from "@vibe/core";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./sign-in.module.css";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type AuthSession = Awaited<ReturnType<SupabaseBrowserClient["auth"]["getSession"]>>["data"]["session"];

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

    const syncSessionAndRedirect = async (incomingSession?: AuthSession | null) => {
      let session = incomingSession ?? null;

      if (!session) {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.warn("Falha ao recuperar sessão persistida", error.message);
          return;
        }

        session = data.session;
      }

      if (!session?.user) {
        return;
      }

      if (!session.access_token || !session.refresh_token) {
        console.warn("Sessão sem tokens suficientes para sincronizar cookies. Solicitando novo login.");
        await supabase.auth.signOut();
        if (active) {
          setStatus("idle");
          setMsg(null);
        }
        return;
      }

      if (!active || redirected) {
        return;
      }

      setStatus("loading");
      setMsg("Confirmando sua sessão...");

      try {
        const response = await fetch("/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Falha ao sincronizar sessão (${response.status})`);
        }

        redirectAuthenticatedUser();
      } catch (syncError) {
        console.warn("Não foi possível sincronizar a sessão persistida", syncError);
        await supabase.auth.signOut();
        if (active) {
          setStatus("idle");
          setMsg("Sua sessão expirou. Solicite um novo link para continuar.");
        }
      }
    };

    void syncSessionAndRedirect();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        void syncSessionAndRedirect(session);
      }
    });

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
