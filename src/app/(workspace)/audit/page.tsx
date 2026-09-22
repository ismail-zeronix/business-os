import { requireActor } from "@/core/permissions/actor";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { EmptyState } from "@/components/application/states";
import { DateRangeFilter } from "@/components/data-table/date-filter";
import { FilterBar } from "@/components/data-table/filter-bar";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Pagination } from "@/components/data-table/pagination";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeAge, zonedInputToUtc } from "@/lib/format";
import { firstParam, parsePage } from "@/lib/search-params";
import { auditActionLabel, describeDetails, humanizeField } from "@/modules/audit/describe";
import { listActorOptions, listAudit, type AuditRow } from "@/modules/audit/queries";
import { AUDIT_ENTITY_TYPES } from "@/modules/audit/types";

export const metadata: Metadata = { title: "Audit" };

const PAGE_LINKS: Record<string, string> = { Supplier: "suppliers", Product: "products", Broadcast: "broadcasts", Quotation: "quotations" };

/** Where to open the record behind an audit row: the entity itself, or its owning aggregate (a contact -> its supplier, an item -> its broadcast). */
function entityHref(row: AuditRow): string | null {
  const own = PAGE_LINKS[row.entityType];
  if (own) return `/${own}/${row.entityId}`;
  const scope = row.scopeType ? PAGE_LINKS[row.scopeType] : undefined;
  return scope && row.scopeId ? `/${scope}/${row.scopeId}` : null;
}

const parseDate = (value: string | undefined, endOfDay = false): Date | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const start = zonedInputToUtc(`${value}T00:00`);
  return start ? new Date(start.getTime() + (endOfDay ? 86_400_000 : 0)) : undefined;
};

/** Read-only, append-only history of who changed what and when. Newest first. */
export default async function AuditPage(props: PageProps<"/audit">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const entityParam = firstParam(searchParams, "entity");
  const actorParam = firstParam(searchParams, "actor");
  const entityType = entityParam && (AUDIT_ENTITY_TYPES as readonly string[]).includes(entityParam) ? entityParam : undefined;
  const actorId = actorParam && z.uuid().safeParse(actorParam).success ? actorParam : undefined;
  const from = parseDate(firstParam(searchParams, "from"));
  const to = parseDate(firstParam(searchParams, "to"), true);
  const page = parsePage(searchParams);

  const [{ rows, total }, actors] = await Promise.all([listAudit({ entityType, actorId, from, to, page }), listActorOptions()]);
  const filtered = Boolean(entityType || actorId || from || to);
  const now = new Date();

  return (
    <>
      <PageHeader title="Audit" subtitle="Who changed what, and when. This record is append-only." />

      <Panel flush>
      <FilterBar clearHref="/audit" hasActiveFilters={filtered}>
        <FilterSelect param="entity" allLabel="All record types" options={AUDIT_ENTITY_TYPES.map((t) => ({ value: t, label: humanizeField(t) }))} />
        <FilterSelect param="actor" allLabel="All people" options={actors} />
        <DateRangeFilter />
      </FilterBar>

      {rows.length === 0 ? (
        <TableShell>
          <EmptyState title={filtered ? "No audit entries match these filters" : "No audit entries yet"} description={filtered ? "Try widening the date range or clearing the filters." : "Changes to suppliers, products and broadcasts are recorded here."} />
        </TableShell>
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-44">Time</TableHead>
                  <TableHead className="w-32">Actor</TableHead>
                  <TableHead className="w-56">Action</TableHead>
                  <TableHead className="w-40">Record</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const href = entityHref(row);
                  const details = describeDetails(row.details);
                  return (
                    <TableRow key={row.id} className="align-top">
                      <TableCell className="h-auto py-2">
                        <span className="num block">{formatDateTime(row.createdAt)}</span>
                        <span className="num block text-xs text-muted-foreground">{formatRelativeAge(row.createdAt, now)}</span>
                      </TableCell>
                      <TableCell className="h-auto py-2">{row.actorName ?? <span className="text-muted-foreground">System</span>}</TableCell>
                      <TableCell className="h-auto py-2 font-medium">{auditActionLabel(row.action)}</TableCell>
                      <TableCell className="h-auto py-2">
                        {href ? (
                          <Link href={href} className="text-brand hover:underline">
                            {humanizeField(row.entityType)}
                          </Link>
                        ) : (
                          humanizeField(row.entityType)
                        )}
                      </TableCell>
                      <TableCell className="h-auto py-2 text-xs whitespace-normal text-muted-foreground">
                        {details.length ? details.map((line) => <div key={line}>{line}</div>) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableShell>
          <Pagination pathname="/audit" searchParams={searchParams} page={page} total={total} />
        </>
      )}
      </Panel>
    </>
  );
}
