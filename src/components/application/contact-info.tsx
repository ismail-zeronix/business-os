import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Unknown } from "@/components/application/states";

export type ContactInfoItem = { icon: LucideIcon; label: string; value: ReactNode | null | undefined };

/**
 * Icon-led rows for a record's contact channels (phone, email, website, address): the icon says what the field is, so the
 * label sits small underneath instead of repeating "Label: value" text. A missing value still renders "Unknown" (never blank).
 */
export function ContactInfoList({ items }: { items: ContactInfoItem[] }) {
  return (
    <div>
      {items.map((item) => {
        const Icon = item.icon;
        const empty = item.value === null || item.value === undefined || item.value === "";
        return (
          <div key={item.label} className="flex items-start gap-2.5 py-1">
            <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="size-3.5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm">{empty ? <Unknown /> : item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
