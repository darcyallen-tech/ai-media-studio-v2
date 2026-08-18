export type ThemeName = "day" | "night";

export const THEME_KEY = "ams-theme";

export function normalizeTheme(value: unknown): ThemeName {
  return value === "night" ? "night" : "day";
}

export function readStoredTheme(): ThemeName {
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "day";
  }
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}
