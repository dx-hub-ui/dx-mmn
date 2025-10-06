// src/app/layout.tsx
import "./globals.css";
import "monday-ui-style/dist/index.css"; // ✅ estilos base do Monday/Vibe

export const metadata = { title: "DX Vibe" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body id="main" className="light-app-theme">{children}</body>
    </html>
  );
}
