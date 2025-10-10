// src/app/layout.tsx
import { Suspense } from "react";
import "./globals.css";
import { captureException } from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { createRequestId, setServerRequestContext } from "@/lib/request-context";
import { ObservabilityProvider } from "@/providers/ObservabilityProvider";
import {
  ThemePreference,
  getBodyThemeClass,
  getHtmlThemeClass,
  getInitialThemeScript,
  resolveInitialTheme,
  themePreferenceFromString,
} from "@/lib/theme";

export const metadata = { title: "DX Vibe" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = headers();
  const existingRequestId = requestHeaders.get("x-request-id");
  const requestId = existingRequestId ?? createRequestId();
  setServerRequestContext({ requestId });

  let profileTheme: ThemePreference | null = null;
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!userError && user) {
      userId = user.id;
      setServerRequestContext({ userId });
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("raw_user_meta_data")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileError && profileRow) {
        const meta = (profileRow.raw_user_meta_data ?? {}) as Record<string, unknown>;
        profileTheme = themePreferenceFromString(meta?.theme_preference);
      }

      const { data: membershipRow } = await supabase
        .from("memberships")
        .select("organization_id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membershipRow?.organization_id) {
        orgId = membershipRow.organization_id;
        setServerRequestContext({ orgId });
      }
    }
  } catch (error) {
    captureException(error);
  }

  const initialTheme = resolveInitialTheme(profileTheme ?? undefined, null);
  const htmlClass = getHtmlThemeClass(initialTheme);
  const bodyClass = getBodyThemeClass(initialTheme);
  const themeInitScript = getInitialThemeScript(profileTheme);

  return (
    <html lang="pt-BR" className={htmlClass} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body id="main" className={bodyClass} suppressHydrationWarning>
        <ObservabilityProvider
          context={{
            requestId,
            userId,
            orgId,
          }}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </ObservabilityProvider>
      </body>
    </html>
  );
}
