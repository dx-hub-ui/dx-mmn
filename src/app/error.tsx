'use client';
import AppShell from '@/components/ui/AppShell';
import { Text, Button } from '@vibe/core';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <AppShell>
      <div className="px-6 py-12 space-y-4">
        <Text type={Text.types.TEXT1} weight={Text.weights.BOLD}>Something went wrong</Text>
        <Button kind={Button.kinds.SECONDARY} onClick={() => reset()}>Try again</Button>
      </div>
    </AppShell>
  );
}
