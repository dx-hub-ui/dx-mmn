"use client";

import { useEffect, useState } from "react";
import type { InboxTab } from "@/types/inbox";

type PreferencesState = {
  tab: InboxTab;
  show: "unread" | "all";
  board: string;
};

const STORAGE_KEY = "dx-inbox-preferences";
const FIVE_MINUTES = 5 * 60 * 1000;
const SCROLL_KEY = "dx-inbox-scroll";

type ScrollState = {
  top: number;
  savedAt: number;
};

function readStorage(initialTab: InboxTab): PreferencesState {
  if (typeof window === "undefined") {
    return { tab: initialTab, show: "unread", board: "all" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { tab: initialTab, show: "unread", board: "all" };
    }
    const parsed = JSON.parse(raw) as Partial<PreferencesState>;
    return {
      tab: (parsed.tab as InboxTab) ?? initialTab,
      show: parsed.show === "all" ? "all" : "unread",
      board: typeof parsed.board === "string" ? parsed.board : "all",
    };
  } catch {
    return { tab: initialTab, show: "unread", board: "all" };
  }
}

export function useInboxPreferences(initialTab: InboxTab) {
  const [state, setState] = useState<PreferencesState>(() => readStorage(initialTab));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }, [state]);

  const saveScroll = (top: number) => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const payload: ScrollState = { top, savedAt: Date.now() };
      window.sessionStorage.setItem(SCROLL_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const readScroll = () => {
    if (typeof window === "undefined") {
      return 0;
    }
    try {
      const raw = window.sessionStorage.getItem(SCROLL_KEY);
      if (!raw) {
        return 0;
      }
      const parsed = JSON.parse(raw) as ScrollState;
      if (Date.now() - parsed.savedAt > FIVE_MINUTES) {
        return 0;
      }
      return parsed.top ?? 0;
    } catch {
      return 0;
    }
  };

  return {
    state,
    setState,
    saveScroll,
    readScroll,
  } as const;
}
