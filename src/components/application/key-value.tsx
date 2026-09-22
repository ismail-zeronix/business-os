import type { ReactNode } from "react";
import { Unknown } from "@/components/application/states";

export type KeyValueItem = { label: string; value: ReactNode | null | undefined; mono?: boolean };

/** Dense definition list for profiles. A missing value renders an explicit muted "Unknown", never a blank. */
export function KeyValue({ items, columns = 2 }: { items: KeyValueItem[]; columns?: 1 | 2 | 3 }) {
  const cols = columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <dl className={`grid ${cols} gap-x-8 gap-y-3`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={`mt-0.5 text-sm break-words ${item.mono ? "font-mono" : ""}`}>
            {item.value === null || item.value === undefined || item.value === "" ? <Unknown /> : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
