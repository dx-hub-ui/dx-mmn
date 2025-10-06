// src/app/(app)/page.tsx
"use client";

import { Flex, Text, Button, Divider } from "@vibe/core";
import { Home as HomeIcon, Add as AddIcon } from "@vibe/icons";

export default function HomePage() {
  return (
    // use um container neutro; o espaçamento externo vem do AppShell (.content)
    <div style={{ display: "grid", gap: "16px" }}>
      <Flex gap={12} align={Flex.align.CENTER}>
        <HomeIcon aria-label="home" size={18} />
        <Text type={Text.types.TEXT1} weight={Text.weights.BOLD}>
          Welcome to Vibe Starter
        </Text>
      </Flex>

      <Divider />

      <Flex gap={12}>
        <Button kind={Button.kinds.PRIMARY}>
          <AddIcon aria-label="add" />
          Create
        </Button>
        <Button kind={Button.kinds.SECONDARY}>Secondary</Button>
      </Flex>
    </div>
  );
}
