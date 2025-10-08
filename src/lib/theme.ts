export const THEME_OPTIONS = ["light", "dark", "night"] as const;
export type ThemePreference = (typeof THEME_OPTIONS)[number];

export const DEFAULT_THEME: ThemePreference = "light";
export const THEME_STORAGE_KEY = "theme";

const HTML_THEME_CLASS_MAP: Record<ThemePreference, string> = {
  light: "theme-light",
  dark: "theme-dark",
  night: "theme-night",
};

const BODY_THEME_CLASS_MAP: Record<ThemePreference, string> = {
  light: "light-app-theme",
  dark: "dark-app-theme",
  night: "night-app-theme",
};

export const HTML_THEME_CLASSES = Object.values(HTML_THEME_CLASS_MAP);
export const BODY_THEME_CLASSES = Object.values(BODY_THEME_CLASS_MAP);

export function themePreferenceFromString(value: unknown): ThemePreference | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/^theme-/, "");
  if ((THEME_OPTIONS as readonly string[]).includes(normalized)) {
    return normalized as ThemePreference;
  }

  if (value === "light-app-theme" || value === "default-app-theme") {
    return "light";
  }

  if (value === "dark-app-theme" || value === "black-app-theme") {
    return "dark";
  }

  if (value === "night-app-theme") {
    return "night";
  }

  return null;
}

export function getHtmlThemeClass(theme: ThemePreference): string {
  return HTML_THEME_CLASS_MAP[theme];
}

export function getBodyThemeClass(theme: ThemePreference): string {
  return BODY_THEME_CLASS_MAP[theme];
}

export function persistThemePreference(theme: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function readStoredTheme(): ThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return themePreferenceFromString(stored);
}

export function applyTheme(theme: ThemePreference, options?: { persist?: boolean }) {
  if (typeof document === "undefined") {
    return;
  }

  const html = document.documentElement;
  HTML_THEME_CLASSES.forEach((cls) => {
    html.classList.remove(cls);
  });
  html.classList.add(getHtmlThemeClass(theme));

  if (document.body) {
    BODY_THEME_CLASSES.forEach((cls) => {
      document.body.classList.remove(cls);
    });
    document.body.classList.add(getBodyThemeClass(theme));
  }

  if (options?.persist ?? true) {
    persistThemePreference(theme);
  }
}

export function resolveInitialTheme(profileTheme?: string | null, storedTheme?: ThemePreference | null): ThemePreference {
  const fromProfile = themePreferenceFromString(profileTheme ?? undefined);
  if (fromProfile) {
    return fromProfile;
  }

  if (storedTheme) {
    return storedTheme;
  }

  return DEFAULT_THEME;
}

export function getInitialThemeScript(profileTheme: ThemePreference | null): string {
  return `(() => {
  try {
    const html = document.documentElement;
    const body = document.body;
    const htmlClasses = ${JSON.stringify(HTML_THEME_CLASSES)};
    const bodyClasses = ${JSON.stringify(BODY_THEME_CLASSES)};
    const themeToHtml = ${JSON.stringify(HTML_THEME_CLASS_MAP)};
    const themeToBody = ${JSON.stringify(BODY_THEME_CLASS_MAP)};
    const knownThemes = ${JSON.stringify(THEME_OPTIONS)};
    let finalTheme = ${profileTheme ? `"${profileTheme}"` : "null"};

    if (finalTheme && !knownThemes.includes(finalTheme)) {
      finalTheme = null;
    }

    if (finalTheme) {
      try { localStorage.setItem('${THEME_STORAGE_KEY}', finalTheme); } catch (error) { /* ignore */ }
    } else {
      let stored = null;
      try {
        stored = localStorage.getItem('${THEME_STORAGE_KEY}');
      } catch (error) {
        stored = null;
      }
      if (stored && knownThemes.includes(stored)) {
        finalTheme = stored;
      }
    }

    if (!finalTheme || !knownThemes.includes(finalTheme)) {
      finalTheme = '${DEFAULT_THEME}';
    }

    htmlClasses.forEach((cls) => html.classList.remove(cls));
    html.classList.add(themeToHtml[finalTheme]);

    if (body) {
      bodyClasses.forEach((cls) => body.classList.remove(cls));
      body.classList.add(themeToBody[finalTheme]);
    }
  } catch (error) {
    console.warn('[theme] failed to initialize', error);
  }
})();`;
}
