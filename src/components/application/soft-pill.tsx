import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Design v3: soft "pastel" pill-shaped status chips (shadcn <Badge> with a tone) and initials avatars (shadcn <Avatar>). Safe in server and client
 * trees. Every colour class is written out in full so Tailwind can see it. The meaning of each tone lives in one place per domain (see
 * status-badges.tsx), never here.
 */

export type PillTone = "neutral" | "amber" | "orange" | "red" | "rose" | "green" | "teal" | "sky" | "blue" | "indigo" | "violet";

const TONE: Record<PillTone, { pill: string; dot: string; avatar: string }> = {
  neutral: { pill: "bg-muted text-foreground/70", dot: "bg-zinc-400", avatar: "bg-muted text-muted-foreground" },
  amber: { pill: "bg-amber-100 text-amber-900", dot: "bg-amber-500", avatar: "bg-amber-100 text-amber-800" },
  orange: { pill: "bg-orange-100 text-orange-900", dot: "bg-orange-500", avatar: "bg-orange-100 text-orange-800" },
  red: { pill: "bg-red-100 text-red-800", dot: "bg-red-500", avatar: "bg-red-100 text-red-800" },
  rose: { pill: "bg-rose-100 text-rose-800", dot: "bg-rose-500", avatar: "bg-rose-100 text-rose-800" },
  green: { pill: "bg-green-100 text-green-800", dot: "bg-green-600", avatar: "bg-green-100 text-green-800" },
  teal: { pill: "bg-teal-100 text-teal-800", dot: "bg-teal-500", avatar: "bg-teal-100 text-teal-800" },
  sky: { pill: "bg-sky-100 text-sky-800", dot: "bg-sky-500", avatar: "bg-sky-100 text-sky-800" },
  blue: { pill: "bg-lime-100 text-lime-900", dot: "bg-lime-600", avatar: "bg-lime-100 text-lime-900" },
  indigo: { pill: "bg-emerald-100 text-emerald-900", dot: "bg-emerald-600", avatar: "bg-emerald-100 text-emerald-900" },
  violet: { pill: "bg-violet-100 text-violet-800", dot: "bg-violet-500", avatar: "bg-violet-100 text-violet-800" },
};

/** shadcn Badge in a tone: 24px chip, tinted background, no border. `dot` adds a small leading status dot. */
export function SoftPill({ tone = "neutral", dot = false, children, className, title }: { tone?: PillTone; dot?: boolean; children: ReactNode; className?: string; title?: string }) {
  return (
    <Badge title={title} className={cn("gap-1.5", TONE[tone].pill, className)}>
      {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", TONE[tone].dot)} /> : null}
      {children}
    </Badge>
  );
}

const AVATAR_TONES: PillTone[] = ["blue", "violet", "teal", "amber", "rose", "sky", "green", "orange"];

function initialsOf(name: string): string {
  const words = name.replace(/\(.*?\)/g, " ").split(/[\s@._-]+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** shadcn Avatar with initials. The colour is derived from the name, so the same customer always looks the same. `muted` = not a saved record. */
export function InitialsAvatar({ name, size = 32, muted = false, className }: { name: string; size?: number; muted?: boolean; className?: string }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const tone = muted ? "neutral" : AVATAR_TONES[hash % AVATAR_TONES.length]!;
  return (
    <Avatar aria-hidden style={{ width: size, height: size }} className={cn("after:hidden", className)}>
      <AvatarFallback
        style={{ fontSize: Math.round(size * 0.36) }}
        className={cn("font-semibold", TONE[tone].avatar, muted && "border border-dashed border-zinc-300")}
      >
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
