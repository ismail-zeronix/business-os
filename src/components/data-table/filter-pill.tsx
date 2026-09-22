"use client";

import { Check, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SoftPill, type PillTone } from "@/components/application/soft-pill";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FilterPillOption = { value: string; label: string; tone?: PillTone };

/**
 * Design v3: a pill-shaped filter dropdown that writes one URL parameter. Multi mode is a searchable checklist (values are joined with
 * commas: `?status=NEW,SOURCING`); single mode picks one value and closes. Options with a tone are drawn as the same soft pills the table
 * uses, so the filter and the rows speak the same language. Changing a filter always resets pagination.
 */
export function FilterPill({
  param,
  label,
  options,
  mode = "multi",
  defaultValue,
  searchable = options.length > 6,
  className,
}: {
  param: string;
  label: string;
  options: FilterPillOption[];
  mode?: "multi" | "single";
  /** Single mode: the value that applies when the parameter is absent. Choosing it removes the parameter. */
  defaultValue?: string;
  searchable?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const raw = searchParams.get(param);
  const chosen = raw ? raw.split(",").filter(Boolean) : [];
  const effective = mode === "single" && chosen.length === 0 && defaultValue ? [defaultValue] : chosen;
  const active = mode === "multi" ? chosen.length > 0 : effective[0] !== defaultValue && effective.length > 0;
  const summary = mode === "single" ? options.find((o) => o.value === effective[0])?.label : null;

  function commit(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0 || (mode === "single" && next[0] === defaultValue)) params.delete(param);
    else params.set(param, next.join(","));
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function choose(value: string) {
    if (mode === "single") {
      // With no default, choosing the selected value again clears the filter.
      commit(!defaultValue && chosen[0] === value ? [] : [value]);
      setOpen(false);
      return;
    }
    commit(chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border bg-background px-3.5 text-sm whitespace-nowrap transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60",
            active && "border-brand/40 bg-brand/10 text-brand hover:bg-brand/10",
            className,
          )}
        >
          {label}
          {mode === "single" && summary ? <span className={cn("font-medium", active ? "text-brand" : "text-muted-foreground")}>{summary}</span> : null}
          {mode === "multi" && chosen.length > 0 ? <span className="num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-primary px-1 text-[11px] font-medium text-primary-foreground">{chosen.length}</span> : null}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} strokeWidth={1.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 rounded-lg p-0 shadow-float">
        <Command>
          {searchable ? <CommandInput placeholder={`Search ${label.toLowerCase()}`} /> : null}
          <CommandList className="max-h-72 p-1.5">
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup className="p-0">
              {options.map((option) => {
                const selected = effective.includes(option.value);
                return (
                  <CommandItem key={option.value} value={option.label} onSelect={() => choose(option.value)} className="h-9 gap-2.5 rounded-lg px-2">
                    {mode === "multi" ? <Checkbox checked={selected} tabIndex={-1} aria-hidden className="pointer-events-none" /> : null}
                    {option.tone ? <SoftPill tone={option.tone}>{option.label}</SoftPill> : <span className="truncate">{option.label}</span>}
                    {mode === "single" && selected ? <Check className="ml-auto size-4 text-brand" aria-hidden /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {mode === "multi" && chosen.length > 0 ? (
            <div className="border-t p-1.5">
              <button type="button" onClick={() => commit([])} className="h-8 w-full rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                Clear {label.toLowerCase()}
              </button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
