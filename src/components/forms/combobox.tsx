"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SelectOption } from "./multi-select";

/**
 * Searchable single select that submits with the form (hidden input). Use it when the list can be long (suppliers, contacts).
 * `clearable` lets the user go back to "nothing selected" by choosing the selected item again.
 * Uncontrolled by default (`defaultValue`); pass `value` (with `onValueChange`) when something else, such as an @ mention, also sets it.
 */
export function Combobox({
  name,
  options,
  defaultValue = null,
  value: controlled,
  placeholder = "Select",
  id,
  disabled,
  clearable = false,
  onValueChange,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string | null;
  value?: string | null;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  clearable?: boolean;
  onValueChange?: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState<string | null>(defaultValue);
  const value = controlled !== undefined ? controlled : inner;
  const label = options.find((o) => o.value === value)?.label ?? null;

  function choose(next: string) {
    const resolved = clearable && next === value ? null : next;
    if (controlled === undefined) setInner(resolved);
    onValueChange?.(resolved);
    setOpen(false);
  }

  return (
    <>
      <input type="hidden" name={name} value={value ?? ""} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">
            <span className={cn("truncate", !label && "text-muted-foreground")}>{label ?? placeholder}</span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>Nothing found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem key={option.value} value={option.label} onSelect={() => choose(option.value)}>
                    <Check className={cn("size-4", value === option.value ? "opacity-100" : "opacity-0")} aria-hidden />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
