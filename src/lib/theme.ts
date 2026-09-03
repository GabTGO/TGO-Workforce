// Shared by ThemeToggle (the header icon button) and the Profile page's
// Appearance card — both apply/read the same "light" | "dark" theme, so the
// DOM + localStorage logic lives here once instead of in either component.

import type { Theme } from "@/lib/session";

export const THEME_STORAGE_KEY = "tgo-theme";

/** Applies a theme to the DOM and caches it locally so the next page load
 * paints correctly before the account preference round-trip resolves. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function readStoredTheme(): Theme {
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark"
    ? "dark"
    : "light";
}
