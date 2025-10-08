// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Flex, Loader, Text } from "@vibe/core";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo")?.startsWith("/") ? searchParams.get("redirectTo")! : "/dashboard";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [err, setErr] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const surfaceError = (message: string) => {
      if (!cancelled) {
        setErr(message);
        setProcessing(false);
      }
    };

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const search = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const pickParam = (key: string) => search.get(key) ?? hash.get(key);

        const errorDescription = pickParam("error_description") ?? pickParam("error");
        if (errorDescription) {
          surfaceError(errorDescription);
          return;
        }

        let {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          surfaceError(sessionError.message);
          return;
        }

        const captureSession = (maybeSession: typeof session) => {
          if (maybeSession) {
            session = maybeSession;
          }
        };

        if (!session) {
          const code = pickParam("code");
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              const message = error.message ?? "Falha ao validar código.";
              if (/code verifier/i.test(message) || /invalid request/i.test(message)) {
                console.warn("Supabase PKCE fallback:", message);
              } else {
                surfaceError(message);
                return;
              }
            } else {
              captureSession(data.session);
            }
          }
        }

        if (!session) {
          const token = pickParam("token");
          const tokenHash = pickParam("token_hash");
          if (token || tokenHash) {
            const typeParam = (pickParam("type") ?? "magiclink") as Parameters<typeof supabase.auth.verifyOtp>[0]["type"];
            const emailParam = pickParam("email") ?? undefined;

            const verifyPayload: Parameters<typeof supabase.auth.verifyOtp>[0] = {
              type: typeParam,
            } as Parameters<typeof supabase.auth.verifyOtp>[0];

            if (token) {
              (verifyPayload as { token: string }).token = token;
            } else if (tokenHash) {
              (verifyPayload as { token_hash: string }).token_hash = tokenHash;
            }

            if (emailParam) {
              (verifyPayload as { email?: string }).email = emailParam;
            }

            const { data, error } = await supabase.auth.verifyOtp(verifyPayload);
            if (error) {
              surfaceError(error.message);
              return;
            }
            captureSession(data.session);
          }
        }

        if (!session) {
          const accessToken = pickParam("access_token");
          const refreshToken = pickParam("refresh_token");
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (error) {
              surfaceError(error.message);
              return;
            }
            captureSession(data.session);
          }
        }

        if (!session) {
          surfaceError("Link inválido ou expirado.");
          return;
        }

        const accessToken = session.access_token;
        const refreshToken = session.refresh_token;
        if (!accessToken || !refreshToken) {
          surfaceError("Link inválido ou expirado.");
          return;
        }

        const syncResponse = await fetch("/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
          cache: "no-store",
        });

        if (!syncResponse.ok) {
          const bodyText = await syncResponse.text().catch(() => "Falha ao sincronizar.");
          surfaceError(bodyText || "Falha ao sincronizar.");
          return;
        }

        const clean = new URL(window.location.href);
        clean.hash = "";
        clean.search = "";
        clean.pathname = "/auth/callback";
        window.history.replaceState({}, "", clean.toString());

        window.location.replace(redirectTo);
      } catch (error) {
        console.error("Erro ao processar callback de autenticação", error);
        const message = error instanceof Error ? error.message : "Erro desconhecido.";
        surfaceError(message);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [redirectTo, supabase]);

  return (
    <Flex
      direction={Flex.directions.COLUMN}
      align={Flex.align.CENTER}
      justify={Flex.justify.CENTER}
      gap={12}
      style={{ minHeight: "100vh", padding: 24 }}
    >
      {processing && !err ? (
        <>
          <Loader size={Loader.sizes.SMALL} />
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            Confirmando seu acesso...
          </Text>
        </>
      ) : null}

      {err ? (
        <Text type={Text.types.TEXT3} color={Text.colors.NEGATIVE} align={Text.align.CENTER}>
          Erro de autenticação: {err}
        </Text>
      ) : null}
    </Flex>
  );
}
