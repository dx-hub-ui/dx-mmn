import type { Metadata } from 'next';
import './globals.css';
import '@vibe/core/tokens';

export const metadata: Metadata = {
  title: 'Vibe Starter',
  description: 'Next.js + @vibe/core with monday-style App Shell'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body id="main" className="default-app-theme">
        {children}
      </body>
    </html>
  );
}
