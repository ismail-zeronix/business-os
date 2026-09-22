import type { ItemReviewStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { ScrollToSelected } from "./scroll-to-selected";
import { Card } from "@/components/ui/card";

export type LineRange = { start: number; end: number; status: ItemReviewStatus };

const STATUS_BAR: Record<ItemReviewStatus, string> = {
  PENDING: "border-l-warning",
  CONFIRMED: "border-l-success",
  IGNORED: "border-l-muted-foreground/40",
};

/**
 * The original message, verbatim, with line numbers. Lines that belong to an item carry a status-coloured bar, and the selected item's
 * lines are highlighted, so the reviewer never loses the source. Read-only; the evidence itself is immutable.
 */
export function RawPane({
  rawText,
  ranges,
  selected,
  embedded = false,
  title = "Raw broadcast",
  label = "Original supplier message",
}: {
  rawText: string;
  ranges: LineRange[];
  selected: { start: number; end: number } | null;
  /** Inside a drawer: no sticky positioning or height cap. */
  embedded?: boolean;
  /** Heading and accessible name. Defaults are the broadcast wording; the enquiry workspace passes its own. */
  title?: string;
  label?: string;
}) {
  const lines = rawText.split(/\r\n|\r|\n/);
  return (
    <Card role="region" aria-label={label} className={cn("gap-0 overflow-auto py-0 shadow-panel", embedded ? "max-h-96" : "sticky top-4 max-h-[calc(100vh-9rem)]")}>
      <div className="sticky top-0 z-10 border-b bg-surface px-3 py-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{title}</div>
      <ol className="py-1 font-mono text-xs leading-5">
        {lines.map((line, index) => {
          const number = index + 1;
          const range = ranges.find((r) => number >= r.start && number <= r.end);
          const isSelected = Boolean(selected && number >= selected.start && number <= selected.end);
          return (
            <li
              key={number}
              data-raw-anchor={selected && number === selected.start ? "true" : undefined}
              className={cn("flex border-l-2 border-l-transparent pr-3", range && STATUS_BAR[range.status], isSelected && "bg-warning-bg")}
            >
              <span className="num w-9 shrink-0 pr-2 text-right text-muted-foreground select-none">{number}</span>
              <span className="min-w-0 break-words whitespace-pre-wrap">{line === "" ? " " : line}</span>
            </li>
          );
        })}
      </ol>
      {selected ? <ScrollToSelected token={`${selected.start}-${selected.end}`} /> : null}
    </Card>
  );
}
