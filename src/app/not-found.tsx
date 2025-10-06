'use client';
import AppShell from '@/components/ui/AppShell';
import { Text, Button } from '@vibe/core';
import Link from 'next/link';

export default function NotFound() {
  return (
    <AppShell>
      <div className="px-6 py-12 space-y-4">
        <Text type={Text.types.TEXT1} weight={Text.weights.BOLD}>Page not found</Text>
        <Text type={Text.types.TEXT3}>The page you’re looking for doesn’t exist.</Text>
        <Link href="/"><Button kind={Button.kinds.PRIMARY}>Go home</Button></Link>
      </div>
    </AppShell>
  );
}
