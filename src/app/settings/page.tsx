'use client';
import AppShell from '@/components/ui/AppShell';
import { Text, Flex } from '@vibe/core';

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-6">
        <Flex direction={Flex.directions.COLUMN} gap={12}>
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>Settings</Text>
          <Text type={Text.types.TEXT3}>Drop your settings UI here.</Text>
        </Flex>
      </div>
    </AppShell>
  );
}
