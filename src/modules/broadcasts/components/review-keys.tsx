"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Keyboard navigation for the review: "j" next item, "k" previous item. Ignored while typing in a field. Renders nothing. */
export function ReviewKeys({ itemIds, currentId }: { itemIds: string[]; currentId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.key !== "j" && event.key !== "k") || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable || target.closest("[role=dialog]"))) return;
      if (itemIds.length === 0) return;
      const index = currentId ? itemIds.indexOf(currentId) : -1;
      const next = event.key === "j" ? Math.min(itemIds.length - 1, index + 1) : Math.max(0, index - 1);
      const id = itemIds[next];
      if (!id || id === currentId) return;
      event.preventDefault();
      const params = new URLSearchParams(searchParams.toString());
      params.set("item", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [itemIds, currentId, pathname, router, searchParams]);

  return null;
}
