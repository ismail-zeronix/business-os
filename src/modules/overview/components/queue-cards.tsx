import { ArrowUpRight, Hourglass, Inbox, Mail, Radio, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatRelativeAge } from "@/lib/format";
import type { QueueCounts } from "../queries";

export type QueueCard = { key: string; label: string; value: number; hint: string; href: string; icon: LucideIcon };

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

/**
 * The four work queues as a list of card definitions. A future queue is one more entry here (and one count in queries.ts). Each card is a
 * link to the place where the work is done; the hint says how long the oldest item has waited, or "Nothing waiting".
 */
export function queueCards(queues: QueueCounts, now: Date): QueueCard[] {
  const age = (date: Date | null, prefix: string) => (date ? `${prefix} ${formatRelativeAge(date, now)}` : "Nothing waiting");
  return [
    { key: "enquiries", label: "Enquiries to review", value: queues.enquiriesToReview.count, hint: age(queues.enquiriesToReview.oldestAt, "Oldest received"), href: "/enquiries", icon: Inbox },
    { key: "replies", label: "Awaiting supplier reply", value: queues.awaitingSupplierReply.count, hint: age(queues.awaitingSupplierReply.oldestAt, "Oldest sent"), href: "/?tab=waiting", icon: Hourglass },
    {
      key: "broadcasts",
      label: "Broadcasts to review",
      value: queues.broadcastsToReview.count,
      hint: queues.broadcastsToReview.count > 0 ? `${plural(queues.broadcastsToReview.pendingItems, "item")} pending` : "Nothing waiting",
      href: "/broadcasts",
      icon: Radio,
    },
    { key: "emails", label: "Emails to triage", value: queues.emailsToTriage.count, hint: age(queues.emailsToTriage.newestAt, "Latest arrived"), href: "/enquiries?view=email", icon: Mail },
  ];
}

export function QueueCards({ cards }: { cards: QueueCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ key, label, value, hint, href, icon: Icon }) => (
        <Link key={key} href={href} className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
          <Card className="flex-row items-center gap-4 px-5 py-4 shadow-panel transition-colors group-hover:bg-muted/40">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-green-50 text-brand">
              <Icon className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-muted-foreground">{label}</p>
              <p className="num text-2xl leading-tight font-bold">{value.toLocaleString("en-US")}</p>
              <p className="truncate text-xs text-muted-foreground">{hint}</p>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.5} aria-hidden />
          </Card>
        </Link>
      ))}
    </div>
  );
}
