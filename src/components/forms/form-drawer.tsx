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
 */
export function FormDrawer({ trigger, title, description, children }: { trigger: ReactNode; title: string; description?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ close }), [close]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
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
