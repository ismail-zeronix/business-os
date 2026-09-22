"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

export type FilterOption = { value: string; label: string };

/** Compact select that writes a single URL param (`?status=`), resets pagination, and offers an explicit "all" choice. */
export function FilterSelect({ param, allLabel, options }: { param: string; allLabel: string; options: FilterOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? ALL;

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === ALL) params.delete(param);
    else params.set(param, next);
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={allLabel} className="min-w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
