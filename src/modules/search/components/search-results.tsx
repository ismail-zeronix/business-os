import Link from "next/link";
import { RecordStatusBadge, TemporaryBadge } from "@/components/application/status-badges";
import { Badge } from "@/components/ui/badge";
import { ProductIntelligenceTable } from "@/modules/observations/components/offers";
import type { SearchResult } from "../queries";

const BASIS_LABEL: Record<NonNullable<SearchResult["match"]>["basis"], string> = {
  PART_NUMBER: "Part number",
  MODEL: "Model",
  ALIAS: "Alias",
};

/** Why a product was pinned to the top. "Exact" and "probable" are the matcher's words (products/matching.ts); the person decides. */
function MatchLabel({ match }: { match: NonNullable<SearchResult["match"]> }) {
  const exact = match.strength === "EXACT";
  return (
    <Badge variant={exact ? "success" : "info"} title={exact ? "Exact match" : "Probable match: check it is the right product"}>
      {exact ? "Exact" : "Probable"} · {BASIS_LABEL[match.basis]}
    </Badge>
  );
}

/** One matched product: identity and aliases, then what each supplier most recently said about price and stock. */
function ResultBlock({ result, evidenceHref }: { result: SearchResult; evidenceHref: (observationId: string) => string }) {
  const subtitle = [result.brandName, result.categoryName].filter(Boolean).join(" · ");
  return (
    <section className="border-b border-border/70 last:border-b-0" aria-label={result.name}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <Link href={`/products/${result.id}`} className="text-sm font-medium hover:underline">
          {result.name}
        </Link>
        {result.partNumber ? <span className="font-mono text-xs text-muted-foreground">{result.partNumber}</span> : null}
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
        {result.match ? <MatchLabel match={result.match} /> : null}
        {result.isTemporary ? <TemporaryBadge /> : null}
        {result.status !== "ACTIVE" ? <RecordStatusBadge status={result.status} /> : null}
        {result.aliases.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1" aria-label="Aliases">
            {result.aliases.map((alias) => (
              <span key={alias} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/70">
                {alias}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      {result.suppliers.length > 0 ? (
        <ProductIntelligenceTable rows={result.suppliers} evidenceHref={evidenceHref} />
      ) : (
        <p className="border-t border-border/70 px-4 py-2 text-xs text-muted-foreground">No supplier price or stock observed for this product yet.</p>
      )}
    </section>
  );
}

export function SearchResults({ results, evidenceHref }: { results: SearchResult[]; evidenceHref: (observationId: string) => string }) {
  return (
    <div>
      {results.map((result) => (
        <ResultBlock key={result.id} result={result} evidenceHref={evidenceHref} />
      ))}
    </div>
  );
}
