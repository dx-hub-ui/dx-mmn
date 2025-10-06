'use client';
import AppShell from '@/components/ui/AppShell';
import { Flex, Text, Button, Divider } from '@vibe/core';
import { Home, Add } from '@vibe/icons';

export default function HomePage() {
  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <Flex gap={12} align={Flex.align.CENTER}>
          <Home aria-label="home" />
          <Text type={Text.types.TEXT1} weight={Text.weights.BOLD}>
            Welcome to Vibe Starter
          </Text>
        </Flex>
        <Divider />
        <Flex gap={12}>
          <Button kind={Button.kinds.PRIMARY}>
            <Add aria-label="add" />
            Create
          </Button>
          <Button kind={Button.kinds.SECONDARY}>Secondary</Button>
        </Flex>
      </div>
    </AppShell>
  );
}
