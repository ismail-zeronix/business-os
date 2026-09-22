"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

/** Renders `children` into a DOM node owned by the top navbar. The node exists only in the browser, so nothing renders on the server. */
function Portal({ id, children }: { id: string; children: ReactNode }) {
  // useSyncExternalStore is the hydration-safe way to read the DOM: the server snapshot is null, the client snapshot is the real node.
  const target = useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById(id),
    () => null,
  );
  return target ? createPortal(children, target) : null;
}

/**
 * Puts buttons in the top navbar's right side. A page (through <PageHeader actions>) or a tab's content can use it; the buttons stay
 * owned by the component that rendered them (their state, drawers and server actions keep working) and disappear with it, so a tab's
 * actions show only while that tab is open.
 */
export function TopbarActions({ children }: { children: ReactNode }) {
  return <Portal id="topbar-actions">{children}</Portal>;
}

/** Puts small status chips (a record's status, priority) next to the breadcrumbs in the top navbar. */
export function TopbarMeta({ children }: { children: ReactNode }) {
  return <Portal id="topbar-meta">{children}</Portal>;
}
