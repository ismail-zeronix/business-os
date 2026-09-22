import Link from "next/link";
import { PanelCaption } from "@/components/application/page-header";
import { ProductIntelligenceTable } from "@/modules/observations/components/offers";
import type { ItemIntelligence } from "../intelligence";

/**
 * "What do we already know?" for one requirement. Shows what each supplier most recently said about the linked product (latest price and
 * stock, age, evidence) exactly as stated: no ranking, no conversion. With no linked product it says so instead of guessing.
 * Also lists the active suppliers who handle the brand, which is useful even before any observation exists.
 */
export function IntelligencePanel({
  intelligence,
  linked,
  brandName,
  evidenceHref,
}: {
  intelligence: ItemIntelligence;
  linked: boolean;
  brandName: string | null;
  evidenceHref: (observationId: string) => string;
}) {
  return (
    <section aria-label="Supplier intelligence" className="space-y-2">
      <PanelCaption>Supplier intelligence</PanelCaption>

      {linked ? (
        <ProductIntelligenceTable rows={intelligence.offers} evidenceHref={evidenceHref} />
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">Link a product to see the latest supplier prices and stock for this requirement.</p>
      )}

      {brandName ? (
        <p className="text-xs text-muted-foreground">
          {intelligence.coverage.length ? (
            <>
              Suppliers who handle {brandName}:{" "}
              {intelligence.coverage.map((supplier, index) => (
                <span key={supplier.supplierId}>
                  {index > 0 ? ", " : ""}
                  <Link href={`/suppliers/${supplier.supplierId}`} className="text-foreground hover:underline">
                    {supplier.name}
                  </Link>
                </span>
              ))}
            </>
          ) : (
            <>No active supplier is set up for {brandName} yet.</>
          )}
        </p>
      ) : null}
    </section>
  );
}
