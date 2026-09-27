import { attributeValue } from "@/modules/specs/format";
import { ATTRIBUTES } from "@/modules/specs/registry";
import { cn } from "@/lib/utils";

export type ProductAttributeView = {
  id: string;
  attributeKey: string;
  rawValue: string;
  valueText: string | null;
  valueNum: number | null;
  valueList: string[];
  unit: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  source: "PARSER" | "AI" | "HUMAN";
};

const ORDER = new Map(ATTRIBUTES.map((a, i) => [a.key, i]));
const LABEL = new Map(ATTRIBUTES.map((a) => [a.key, a.label]));
const SOURCE = { PARSER: "read from the product text", AI: "suggested by AI", HUMAN: "set by a person" } as const;

/**
 * What this product IS, as structured values read from its own name and description, plus the model key that groups its variants.
 * Read-only for now. A specification that is not listed is UNKNOWN, not "none". Dashed = a probable rather than a clear reading.
 */
export function ProductSpecifications({ attributes, modelKey }: { attributes: ProductAttributeView[]; modelKey: string | null }) {
  const sorted = [...attributes].sort((a, b) => (ORDER.get(a.attributeKey) ?? 99) - (ORDER.get(b.attributeKey) ?? 99));
  return (
    <div className="space-y-2">
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No specifications could be read from this product&apos;s name or description. They stay unknown.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((a) => (
            <span
              key={a.id}
              title={`"${a.rawValue}" - ${SOURCE[a.source]}`}
              className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs", a.confidence === "HIGH" ? "bg-background" : "border-dashed border-amber-400 bg-amber-50 text-amber-950")}
            >
              <span className="text-muted-foreground">{LABEL.get(a.attributeKey) ?? a.attributeKey}</span>
              <span className="font-medium">{attributeValue(a)}</span>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Model key: <span className="font-mono">{modelKey ?? "unknown"}</span>. Products with the same key are variants of one model.
      </p>
    </div>
  );
}
