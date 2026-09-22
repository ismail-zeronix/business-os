import { ArrowRight, ChevronRight, ClipboardCheck, MessageSquare, UserRound, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { UrlSheet } from "@/components/application/url-sheet";
import { EmptyState } from "@/components/application/states";
import { EnquiryStatusPill, PriorityPill } from "@/components/application/status-badges";
import { InitialsAvatar, SoftPill, type PillTone } from "@/components/application/soft-pill";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelativeAge } from "@/lib/format";
import { EVIDENCE_CHANNEL_LABEL, REVIEW_STATUS_LABEL } from "@/lib/labels";
import { auditActionLabel } from "@/modules/audit/describe";
import { listActivity } from "@/modules/audit/queries";
import { getEnquiryPeek, type EnquiryPeek } from "../queries";
import { enquiryReference } from "./enquiries-table";

const REVIEW_TONE: Record<"PENDING" | "CONFIRMED" | "IGNORED", PillTone> = { PENDING: "amber", CONFIRMED: "green", IGNORED: "neutral" };

function Caption({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{children}</h3>;
}

/** A navigation shortcut: a tinted icon square, a title with a hint, and a chevron. */
function ActionRow({ href, icon: Icon, tone, title, hint }: { href: string; icon: LucideIcon; tone: string; title: string; hint: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg border bg-background p-3 transition-colors outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-ring/60">
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
    </Link>
  );
}

async function PeekBody({ enquiry, closeHref }: { enquiry: EnquiryPeek; closeHref: string }) {
  const activity = await listActivity({ type: "Enquiry", id: enquiry.id }, 4);
  const now = new Date();
  const who = enquiry.customer?.name ?? enquiry.requesterName ?? enquiry.requesterEmail ?? "No customer";
  const pending = enquiry.items.filter((i) => i.reviewStatus === "PENDING").length;
  const workspace = `/enquiries/${enquiry.id}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <InitialsAvatar name={who} size={44} muted={!enquiry.customer} />
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{enquiryReference(enquiry.number)}</p>
              <h2 className="truncate text-base font-semibold">{who}</h2>
              {enquiry.subject ? <p className="truncate text-xs text-muted-foreground">{enquiry.subject}</p> : null}
            </div>
          </div>
          <Link href={closeHref} scroll={false} className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60">
            <X className="size-3.5" aria-hidden /> Close
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EnquiryStatusPill status={enquiry.status} />
          <PriorityPill priority={enquiry.priority} />
          {enquiry.archivedAt ? <SoftPill tone="neutral">Archived</SoftPill> : null}
          <span className="text-xs text-muted-foreground">
            Received {formatRelativeAge(enquiry.evidenceSource.observedAt, now)} · {EVIDENCE_CHANNEL_LABEL[enquiry.evidenceSource.channel]}
          </span>
        </div>

        {enquiry.blocker || enquiry.nextAction ? (
          <Alert variant="warning" className="space-y-2 py-3 text-sm">
            {enquiry.blocker ? (
              <p>
                <span className="text-xs font-medium tracking-wide uppercase">Blocked by</span>
                <span className="mt-0.5 block text-foreground">{enquiry.blocker}</span>
              </p>
            ) : null}
            {enquiry.nextAction ? (
              <p>
                <span className="text-xs font-medium tracking-wide uppercase">Next action</span>
                <span className="mt-0.5 block text-foreground">{enquiry.nextAction}</span>
              </p>
            ) : null}
          </Alert>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ["Required by", enquiry.requiredBy ? formatDate(enquiry.requiredBy) : null],
            ["Delivery", enquiry.deliveryLocation],
            ["Contact", enquiry.contact?.name],
            ["Owner", enquiry.assignedTo?.name],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 truncate">{value ?? <span className="text-muted-foreground">Unknown</span>}</dd>
            </div>
          ))}
        </dl>

        <section>
          <Caption>Requirements ({enquiry.items.length})</Caption>
          {enquiry.items.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">No requirements were recognised. Open the enquiry to add them by hand.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {enquiry.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="num w-4 shrink-0 text-xs text-muted-foreground">{item.position}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.description ?? item.modelText ?? "(no description)"}</p>
                    {item.product ? <p className="truncate text-xs text-muted-foreground">{item.product.name}</p> : <p className="text-xs text-muted-foreground">No product linked</p>}
                  </div>
                  {item.quantity != null ? <span className="num shrink-0 text-xs text-muted-foreground">×{item.quantity.toLocaleString("en-US")}</span> : null}
                  <SoftPill tone={REVIEW_TONE[item.reviewStatus]}>{REVIEW_STATUS_LABEL[item.reviewStatus]}</SoftPill>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <Caption>Actions</Caption>
          <div className="space-y-1.5 rounded-lg bg-zinc-50 p-1.5">
            <ActionRow href={workspace} icon={ClipboardCheck} tone="bg-lime-100 text-lime-800" title="Review requirements" hint={pending ? `${pending} waiting for review` : "Everything is reviewed"} />
            <ActionRow href={`${workspace}?view=activity`} icon={MessageSquare} tone="bg-violet-100 text-violet-700" title="Notes and activity" hint="Add a note, see every change" />
            {enquiry.customer ? <ActionRow href={`/customers/${enquiry.customer.id}`} icon={UserRound} tone="bg-emerald-100 text-emerald-700" title="Customer" hint={enquiry.customer.name} /> : null}
          </div>
        </section>

        <section>
          <Caption>Recent activity</Caption>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{auditActionLabel(entry.action)}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.actorName ?? "System"}</p>
                  </div>
                  <span className="num shrink-0 text-xs text-muted-foreground">{formatRelativeAge(entry.createdAt, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="border-t p-4">
        <Button asChild className="h-10 w-full rounded-lg">
          <Link href={workspace}>
            Open enquiry <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Server-rendered quick view for `?peek=<enquiryId>`. Renders nothing when there is no (valid) id. */
export async function EnquiryPeekPanel({ enquiryId, closeHref }: { enquiryId: string | undefined; closeHref: string }) {
  if (!enquiryId || !z.uuid().safeParse(enquiryId).success) return null;
  const enquiry = await getEnquiryPeek(enquiryId);
  return (
    <UrlSheet key={enquiryId} closeHref={closeHref} label={enquiry ? `Quick view of ${enquiryReference(enquiry.number)}` : "Enquiry quick view"}>
      {enquiry ? <PeekBody enquiry={enquiry} closeHref={closeHref} /> : <EmptyState title="Enquiry not found" description="This enquiry does not exist or the link is out of date." />}
    </UrlSheet>
  );
}
