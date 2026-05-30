"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";

const ORDER: Theme[] = ["system", "light", "dark"];
const STORAGE_KEY = "reading-theme";
const listeners = new Set<() => void>();

function getSnapshot(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-reading-theme");
  } else {
    root.setAttribute("data-reading-theme", theme);
  }
}

function setTheme(theme: Theme) {
  if (theme === "system") {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, theme);
  }
  applyTheme(theme);
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Cycles the reading surface between System → Light → Dark. "System" follows
 * prefers-color-scheme (no attribute); an explicit choice sets
 * data-reading-theme on <html>. The preference is read via useSyncExternalStore
 * so it stays SSR-safe (server renders "system", the client reads localStorage).
 */
export function ReadingThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep the DOM attribute in sync with the stored preference (DOM side-effect,
  // not component state).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = theme === "system" ? "Auto" : theme;

  return (
    <button
      type="button"
      className="reading-theme-toggle"
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
      aria-label={`Reading theme: ${label}. Click to change.`}
    >
      <Icon className="icon-sm" />
      {label}
    </button>
  );
}
