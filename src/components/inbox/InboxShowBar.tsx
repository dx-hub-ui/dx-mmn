"use client";

import { Button, Menu, MenuButton, MenuItem, Text } from "@vibe/core";
import { NavigationChevronDown, Check } from "@vibe/icons";
import styles from "./inbox-show-bar.module.css";

type InboxShowBarProps = {
  value: "unread" | "all";
  disabled?: boolean;
  onChange: (value: "unread" | "all") => void;
  onMarkAll: () => void;
};

export default function InboxShowBar({ value, onChange, onMarkAll, disabled }: InboxShowBarProps) {
  return (
    <div className={styles.root}>
      <MenuButton
        ariaLabel="Filtrar por status"
        closeMenuOnItemClick
        disabled={disabled}
        component={() => (
          <Button
            kind={Button.kinds.SECONDARY}
            size={Button.sizes.SMALL}
            rightIcon={NavigationChevronDown}
            className={styles.showButton}
          >
            <Text type={Text.types.TEXT3}>Mostrar</Text>
            <Text type={Text.types.TEXT3} weight={Text.weights.BOLD}>
              {value === "unread" ? "Atualizações não lidas" : "Todas as atualizações"}
            </Text>
          </Button>
        )}
      >
        <Menu>
          <MenuItem
            title="Atualizações não lidas"
            selected={value === "unread"}
            onClick={() => onChange("unread")}
          />
          <MenuItem
            title="Todas as atualizações"
            selected={value === "all"}
            onClick={() => onChange("all")}
          />
        </Menu>
      </MenuButton>
      <Button
        kind={Button.kinds.TERTIARY}
        size={Button.sizes.SMALL}
        leftIcon={Check}
        className={styles.markAll}
        onClick={onMarkAll}
        disabled={disabled}
      >
        Marcar todas como lidas
      </Button>
    </div>
  );
}
