// src/app/(app)/layout.tsx
import AppShell from "@/components/ui/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
