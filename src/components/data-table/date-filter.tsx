"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

/** Two date inputs ("from" / "to") that write `?from=` and `?to=` (YYYY-MM-DD) to the URL and reset pagination. */
export function DateRangeFilter({ fromParam = "from", toParam = "to" }: { fromParam?: string; toParam?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <label htmlFor="date-from">From</label>
      <Input id="date-from" type="date" defaultValue={searchParams.get(fromParam) ?? ""} onChange={(e) => set(fromParam, e.target.value)} className="h-7 w-36 text-xs" />
      <label htmlFor="date-to">to</label>
      <Input id="date-to" type="date" defaultValue={searchParams.get(toParam) ?? ""} onChange={(e) => set(toParam, e.target.value)} className="h-7 w-36 text-xs" />
    </div>
  );
}
