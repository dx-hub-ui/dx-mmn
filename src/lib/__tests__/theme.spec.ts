import { describe, expect, it, beforeEach } from "vitest";
import {
  applyTheme,
  getBodyThemeClass,
  getHtmlThemeClass,
  readStoredTheme,
  resolveInitialTheme,
  themePreferenceFromString,
} from "../theme";

describe("theme helpers", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.body.className = "";
    window.localStorage.clear();
  });

  it("normaliza strings de tema", () => {
    expect(themePreferenceFromString("theme-light")).toBe("light");
    expect(themePreferenceFromString("dark-app-theme")).toBe("dark");
    expect(themePreferenceFromString("night-app-theme")).toBe("night");
    expect(themePreferenceFromString("unknown")).toBeNull();
  });

  it("aplica classes ao html e body", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains(getHtmlThemeClass("dark"))).toBe(true);
    expect(document.body.classList.contains(getBodyThemeClass("dark"))).toBe(true);
    expect(readStoredTheme()).toBe("dark");
  });

  it("não persiste quando solicitado", () => {
    applyTheme("night", { persist: false });
    expect(readStoredTheme()).toBeNull();
    expect(document.documentElement.classList.contains(getHtmlThemeClass("night"))).toBe(true);
  });

  it("resolve tema inicial com prioridades corretas", () => {
    expect(resolveInitialTheme("dark", null)).toBe("dark");
    expect(resolveInitialTheme(null, "night")).toBe("night");
    expect(resolveInitialTheme(undefined, null)).toBe("light");
  });
});
