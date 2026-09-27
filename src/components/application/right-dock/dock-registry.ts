import type { ComponentType } from "react";
import { NotebookPen, type LucideIcon } from "lucide-react";
import { ContactNotesPanel } from "@/modules/contact-notes/components/contact-notes-panel";

/**
 * Each tool has its own icon colour so the rail reads at a glance. Full class names (not built strings) so Tailwind can see them;
 * the colours are the existing status tokens. Add a tone here when a new tool needs a new colour.
 */
export const DOCK_TONES = {
  info: { icon: "text-info", active: "bg-info-bg" },
  success: { icon: "text-success", active: "bg-success-bg" },
  warning: { icon: "text-warning", active: "bg-warning-bg" },
  danger: { icon: "text-danger", active: "bg-danger-bg" },
} as const;

/** One tool in the right dock: an icon on the rail and the panel it opens. */
export type DockTool = {
  id: string;
  /** Shown as the tooltip, the icon's accessible name and the panel title. */
  label: string;
  icon: LucideIcon;
  tone: keyof typeof DOCK_TONES;
  Panel: ComponentType;
};

/**
 * The dock's tools, top to bottom on the rail. Adding a tool (quick reference, scratch notes, ...) is one entry here plus its panel component;
 * the rail, the open/close behaviour and the panel frame need no change.
 */
export const DOCK_TOOLS: DockTool[] = [{ id: "contact-notes", label: "Supplier contacts", icon: NotebookPen, tone: "info", Panel: ContactNotesPanel }];
