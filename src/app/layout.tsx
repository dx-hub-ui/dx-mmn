// src/app/layout.tsx
import { Suspense } from "react";
import "./globals.css";
import "monday-ui-style/dist/index.css"; // ✅ estilos base do Monday/Vibe
import PostHogProvider from "@/components/observability/PostHogProvider";
import { captureException } from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  let profileTheme: ThemePreference | null = null;

  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!userError && user) {
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("raw_user_meta_data")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileError && profileRow) {
        const meta = (profileRow.raw_user_meta_data ?? {}) as Record<string, unknown>;
        profileTheme = themePreferenceFromString(meta?.theme_preference);
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
        <Suspense fallback={null}>
          <PostHogProvider />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
