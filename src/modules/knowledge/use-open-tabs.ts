"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "zeronix-knowledge-tabs";
const MAX_TABS = 20;
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(tabs: string[]) {
  cache = tabs;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // best-effort; a private window or blocked storage just loses the tab strip across reloads
  }
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const getServerSnapshot = (): string[] => [];

/**
 * The knowledge pages open as tabs this browser session: a tiny external store backed by localStorage (per-viewer, never sent to the
 * server), read with useSyncExternalStore so no effect calls setState directly (same pattern as `useIsMobile`).
 */
export function useOpenTabs() {
  const tabs = useSyncExternalStore(subscribe, read, getServerSnapshot);

  const openTab = useCallback((path: string) => {
    const current = read();
    if (!current.includes(path)) write([...current, path].slice(-MAX_TABS));
  }, []);

  const closeTab = useCallback((path: string) => {
    write(read().filter((t) => t !== path));
  }, []);

  return { tabs, openTab, closeTab };
}
