"use client";

import { useEffect } from "react";

/**
 * When the selected item changes, scrolls the raw message so its source lines are in view (inside the raw pane, without moving the page).
 * Renders nothing. The target is the line marked `data-raw-anchor="true"` by RawPane.
 */
export function ScrollToSelected({ token }: { token: string }) {
  useEffect(() => {
    document.querySelector<HTMLElement>('[data-raw-anchor="true"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [token]);
  return null;
}
