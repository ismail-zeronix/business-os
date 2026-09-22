"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

/**
 * Searchable multi-select that submits with the surrounding form: one hidden input per selected value, all with the same `name`
 * (read back as a list by formDataToObject / idList). No selection submits nothing, which the schemas treat as "none".
 */
export function MultiSelect({
  name,
  options,
  defaultValue = [],
  placeholder = "Select",
  id,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string[];
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(defaultValue);

  const labels = selected.map((value) => options.find((o) => o.value === value)?.label).filter((l): l is string => Boolean(l));
  const summary = labels.length === 0 ? null : labels.length <= 2 ? labels.join(", ") : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;

  function toggle(value: string) {
    setSelected((current) => (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]));
  }

  return (
    <>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            <span className={cn("truncate", !summary && "text-muted-foreground")}>{summary ?? placeholder}</span>
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
                  <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                    <Check className={cn("size-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")} aria-hidden />
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
