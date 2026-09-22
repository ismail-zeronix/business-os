"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

/**
 * Search box that writes to the URL (`?q=`), debounced, and resets pagination. Press "/" anywhere on the page to focus it.
 * The inner field is keyed by the URL value, so an external change (e.g. "Clear filters") resets the text without an effect.
 */
export function SearchInput({ placeholder = "Search", paramName = "q", className, inputClassName }: { placeholder?: string; paramName?: string; className?: string; inputClassName?: string }) {
  const searchParams = useSearchParams();
  const initial = searchParams.get(paramName) ?? "";
  return <SearchField key={initial} initial={initial} placeholder={placeholder} paramName={paramName} className={className} inputClassName={inputClassName} />;
}

function SearchField({ initial, placeholder, paramName, className, inputClassName }: { initial: string; placeholder: string; paramName: string; className?: string; inputClassName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.trim() === initial) return;
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (value.trim()) next.set(paramName, value.trim());
      else next.delete(paramName);
      next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [value, initial, paramName, pathname, router, searchParams]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={cn("relative w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={`${placeholder}  ( / )`}
        aria-label={placeholder}
        className={cn("h-8 pl-8 text-sm", inputClassName)}
      />
    </div>
  );
}
