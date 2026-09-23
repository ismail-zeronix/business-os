import {
  Archive,
  ArrowRightLeft,
  CheckCheck,
  CircleCheck,
  Dot,
  EyeOff,
  FileCheck2,
  FlaskConical,
  History,
  KeyRound,
  Link2,
  LogIn,
  Mail,
  MailWarning,
  Minus,
  Pencil,
  Phone,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Send,
  StickyNote,
  Tags,
  Undo2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type AuditTone = "neutral" | "success" | "warning" | "danger";

/** Circle background/foreground classes per tone, reusing the exact colours badges already use (docs/design/UI_SYSTEM.md section 6). */
export const AUDIT_TONE_CLASS: Record<AuditTone, string> = {
  neutral: "bg-muted text-foreground/70",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
};

/**
 * Icon and tone for a timeline entry, matched by keyword rather than one entry per exact action, so a future action gets a
 * sensible default (a plain dot, neutral) with no code change. Order matters: more specific keywords are checked first
 * (e.g. "deactivated" before "activated", since the shorter word is a substring of the longer one).
 */
const RULES: { match: string; icon: LucideIcon; tone: AuditTone }[] = [
  { match: "email_failed", icon: MailWarning, tone: "danger" },
  { match: "emailed", icon: Mail, tone: "success" },
  { match: "bulk_confirmed", icon: CheckCheck, tone: "success" },
  { match: "confirmed", icon: CircleCheck, tone: "success" },
  { match: "chosen", icon: CircleCheck, tone: "success" },
  { match: "issued", icon: FileCheck2, tone: "success" },
  { match: "deactivated", icon: PowerOff, tone: "warning" },
  { match: "activated", icon: Power, tone: "success" },
  { match: "status_changed", icon: ArrowRightLeft, tone: "warning" },
  { match: "retracted", icon: Undo2, tone: "warning" },
  { match: "archived", icon: Archive, tone: "warning" },
  { match: "ignored", icon: EyeOff, tone: "warning" },
  { match: "dismissed", icon: X, tone: "warning" },
  { match: "cleared", icon: XCircle, tone: "warning" },
  { match: "reopened", icon: RotateCcw, tone: "neutral" },
  { match: "restored", icon: RotateCcw, tone: "neutral" },
  { match: "note_added", icon: StickyNote, tone: "neutral" },
  { match: "call_logged", icon: Phone, tone: "neutral" },
  { match: "linked", icon: Link2, tone: "neutral" },
  { match: "brands_changed", icon: Tags, tone: "neutral" },
  { match: "categories_changed", icon: Tags, tone: "neutral" },
  { match: "password_changed", icon: KeyRound, tone: "neutral" },
  { match: "password_reset", icon: KeyRound, tone: "neutral" },
  { match: "key_changed", icon: KeyRound, tone: "neutral" },
  { match: "signed_in", icon: LogIn, tone: "neutral" },
  { match: "synced", icon: RefreshCw, tone: "neutral" },
  { match: "tested", icon: FlaskConical, tone: "neutral" },
  { match: "sent", icon: Send, tone: "neutral" },
  { match: "revised", icon: History, tone: "neutral" },
  { match: "updated", icon: Pencil, tone: "neutral" },
  { match: "created", icon: Plus, tone: "neutral" },
  { match: "added", icon: Plus, tone: "neutral" },
  { match: "removed", icon: Minus, tone: "neutral" },
];

export function auditActionVisual(action: string): { icon: LucideIcon; tone: AuditTone } {
  const rule = RULES.find((r) => action.includes(r.match));
  return rule ? { icon: rule.icon, tone: rule.tone } : { icon: Dot, tone: "neutral" };
}
