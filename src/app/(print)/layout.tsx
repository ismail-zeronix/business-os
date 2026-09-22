import type { ReactNode } from "react";

/**
 * Pages made to be printed (the customer's copy of a quotation). No sidebar, no navbar, no application data: just a grey desk with white A4
 * paper on it. The @page rule sets the paper size and margins for the browser's print dialog; on paper the desk and shadow disappear. The
 * colour-adjust rule keeps the theme's greens when the browser would otherwise strip backgrounds to save ink.
 */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-svh bg-muted/50 px-4 py-6 print:min-h-0 print:bg-white print:p-0">
      <style>{"@page { size: A4; margin: 14mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } nextjs-portal { display: none !important; }"}</style>
      {children}
    </main>
  );
}
