"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Right-hand panel driven by the URL (`?peek=`, `?evidence=`, `?email=`), rendered by the server only while the parameter is present, so
 * the view is shareable and the back button works. Closing it removes the parameter (`closeHref`). Two modes on the shadcn <Sheet>:
 *  - with a `title` (and optional `description`): a standard header with a close button, and a scrolling padded body;
 *  - without: the content supplies its own header and full-height layout (the enquiry quick view), and `label` is only the accessible name.
 */
export function UrlSheet({
  closeHref,
  label,
  title,
  description,
  width = "27.5rem",
  children,
}: {
  closeHref: string;
  label: string;
  title?: string;
  description?: string;
  width?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Sheet open onOpenChange={(open) => !open && router.replace(closeHref, { scroll: false })}>
      <SheetContent showCloseButton={Boolean(title)} style={{ maxWidth: width }} className="w-full gap-0 border-l bg-background p-0 outline-none sm:max-w-none">
        {title ? (
          <>
            <SheetHeader className="border-b pr-12">
              <SheetTitle className="text-base">{title}</SheetTitle>
              {description ? <SheetDescription className="text-xs">{description}</SheetDescription> : <SheetDescription className="sr-only">{label}</SheetDescription>}
            </SheetHeader>
            <div className="flex-1 space-y-5 overflow-y-auto p-4">{children}</div>
          </>
        ) : (
          <>
            <SheetTitle className="sr-only">{label}</SheetTitle>
            <SheetDescription className="sr-only">{label}</SheetDescription>
            {children}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
