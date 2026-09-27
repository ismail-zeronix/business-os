"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DOCK_TONES, DOCK_TOOLS } from "./dock-registry";

/**
 * A slim icon rail on the right edge of the workspace, with a panel that opens beside it. The rail takes its own column, so it never covers
 * the page. The panel is not modal (no backdrop): the page stays readable and copyable underneath. A tool's panel stays mounted once it has been
 * opened, so a half-typed note survives closing and reopening. Esc closes it while focus is inside it (so it never fights an open drawer).
 */
export function RightDock() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [opened, setOpened] = useState<string[]>([]);

  function toggle(id: string) {
    setActiveId((current) => (current === id ? null : id));
    setOpened((list) => (list.includes(id) ? list : [...list, id]));
  }

  return (
    <>
      <nav aria-label="Tools" className="flex w-7 shrink-0 flex-col items-center gap-1 border-l bg-surface py-1.5">
        {DOCK_TOOLS.map((tool) => {
          const active = tool.id === activeId;
          const tone = DOCK_TONES[tool.tone];
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => toggle(tool.id)}
                  aria-label={tool.label}
                  aria-pressed={active}
                  className={cn("size-6 rounded-md", tone.icon, active && tone.active)}
                >
                  <tool.icon className="size-3.5" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">{tool.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {DOCK_TOOLS.filter((tool) => opened.includes(tool.id)).map((tool) => (
        <section
          key={tool.id}
          aria-label={tool.label}
          hidden={tool.id !== activeId}
          onKeyDown={(event) => {
            if (event.key === "Escape") setActiveId(null);
          }}
          className="fixed top-16 right-9 bottom-24 z-30 flex w-96 max-w-[calc(100vw-2.75rem)] flex-col overflow-hidden rounded-xl border bg-surface shadow-lg"
        >
          <header className="flex shrink-0 items-center justify-between border-b py-1.5 pr-1.5 pl-3">
            <h2 className="text-sm font-medium">{tool.label}</h2>
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => setActiveId(null)} aria-label={`Close ${tool.label}`}>
              <X strokeWidth={1.5} />
            </Button>
          </header>
          <tool.Panel />
        </section>
      ))}
    </>
  );
}
