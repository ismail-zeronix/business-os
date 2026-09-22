"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Screen-only bar above the paper (hidden when printing and in the PDF). Print uses the browser's print dialog; Download PDF is on the quotation page. */
export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
      <Button asChild variant="ghost" size="sm">
        <Link href={backHref}>
          <ArrowLeft aria-hidden /> Back to quotation
        </Link>
      </Button>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">To save a file, use Download PDF on the quotation page.</span>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden /> Print
        </Button>
      </div>
    </div>
  );
}
