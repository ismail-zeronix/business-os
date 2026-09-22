"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";

/**
 * Single select that submits with the form. Radix Select cannot represent an empty value, so "not provided" is an explicit
 * "Unknown" choice mapped to an empty string in the hidden input (which the schemas turn into null).
 */
export function SelectField({
  name,
  options,
  defaultValue,
  id,
  noneLabel = "Unknown",
  allowNone = true,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  id?: string;
  noneLabel?: string;
  allowNone?: boolean;
}) {
  const [value, setValue] = useState<string>(defaultValue ?? (allowNone ? NONE : (options[0]?.value ?? "")));
  return (
    <>
      <input type="hidden" name={name} value={value === NONE ? "" : value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
