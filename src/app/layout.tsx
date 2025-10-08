// src/app/layout.tsx
import { Suspense } from "react";
import "./globals.css";
import "monday-ui-style/dist/index.css"; // ✅ estilos base do Monday/Vibe
import PostHogProvider from "@/components/observability/PostHogProvider";

export const metadata = { title: "DX Vibe" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body id="main" className="light-app-theme">
        <Suspense fallback={null}>
          <PostHogProvider />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
