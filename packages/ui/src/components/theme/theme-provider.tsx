import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  ThemeContext,
  type ResolvedTheme,
  type Theme,
  type ThemeContextValue,
} from "./theme-context";

const DEFAULT_STORAGE_KEY = "outbound-theme";
const VALID_THEMES = new Set<Theme>(["light", "dark", "system"]);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  /**
   * localStorage key for persisting the user's theme choice. Pass a
   * per-user value (e.g., `outbound-theme:${clerkUserId}`) so themes do
   * not leak across accounts on a shared kiosk. Defaults to
   * `outbound-theme`.
   */
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = DEFAULT_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(storageKey, defaultTheme));
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(readSystemPrefersDark);

  // Consumers that need a different storageKey at runtime (e.g. swapping the
  // anonymous key for a per-user key after sign-in) should remount the
  // provider via `<ThemeProvider key={storageKey} ...>` — the initial
  // useState reader handles the rehydration on the fresh mount.

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // localStorage can throw in private-mode Safari and sandboxed iframes; in-memory state still updates.
      }
    },
    [storageKey],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

function readStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null && VALID_THEMES.has(stored as Theme)) return stored as Theme;
  } catch {
    // see setTheme — localStorage may be unavailable; fall through to default.
  }
  return defaultTheme;
}

function readSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
