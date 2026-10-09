"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const DrawerContext = createContext<{ close: () => void } | null>(null);

/** Lets a form inside a <FormDrawer> close it on success. Outside a drawer it is a no-op. */
export function useDrawerClose(): () => void {
  return useContext(DrawerContext)?.close ?? (() => {});
}

/**
 * Right-hand drawer (480px) for create/edit forms. Preferred over modals; never stacked. Its content is unmounted when it closes,
 * so a reopened drawer always starts from a clean form.
 *
 * Usually used uncontrolled, with `trigger` as the clickable element. When `open`/`onOpenChange` are supplied instead (e.g. opened
 * from a `DropdownMenuItem`'s `onSelect`, where nesting a `SheetTrigger` inside the menu item races with the menu's own close),
 * `trigger` can be omitted and the caller drives visibility itself.
 */
export function FormDrawer({
  trigger,
  title,
  description,
  children,
  open: openProp,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled) onOpenChange?.(next);
      else setInternalOpen(next);
    },
    [controlled, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  const value = useMemo(() => ({ close }), [close]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent className="w-full gap-0 sm:max-w-[30rem]">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description ? <SheetDescription className="text-xs">{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <DrawerContext value={value}>{children}</DrawerContext>
        </div>
      </SheetContent>
    </Sheet>
  );
}
