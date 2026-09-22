import type { ReactNode } from "react";
import { EmptyState } from "@/components/application/states";
import { Card } from "@/components/ui/card";
import type { FreshnessBand } from "@/lib/freshness";
import { cn } from "@/lib/utils";
import type { EnquiryCharts, PriceFreshness } from "../queries";
import { FRESHNESS_ORDER, PIPELINE_LABEL, PIPELINE_STAGES, type PipelineStage } from "../stats";

/** Charts are plain inline SVG and CSS bars (no chart library). Each has a text summary, so the numbers are never only in the picture. */

function ChartCard({ title, meta, children, footer }: { title: string; meta?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="min-w-0 gap-3 p-5 shadow-panel">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      <div className="flex-1">{children}</div>
      {footer ? <div className="border-t pt-3 text-xs text-muted-foreground">{footer}</div> : null}
    </Card>
  );
}

/** Enquiries received per day in the range, and the change against the range before it. */
export function ReceivedChart({ data, days }: { data: EnquiryCharts["received"]; days: number }) {
  const { series, total, changePercent } = data;
  const max = Math.max(...series.map((d) => d.count), 1);
  const slot = 10;
  return (
    <ChartCard
      title="Enquiries received"
      meta={
        <>
          <span className="num font-semibold text-foreground">{total.toLocaleString("en-US")}</span> in {days} days
          {changePercent !== null ? (
            <span className="num">
              {" "}
              · {changePercent > 0 ? "+" : ""}
              {changePercent}% vs previous
            </span>
          ) : null}
        </>
      }
      footer={
        <span className="num flex justify-between gap-2">
          <span>{series[0]?.label}</span>
          <span>
            Busiest day: {max} {max === 1 ? "enquiry" : "enquiries"}
          </span>
          <span>{series[series.length - 1]?.label}</span>
        </span>
      }
    >
      {total === 0 ? (
        <EmptyState title="No enquiries in this period" description="Try a longer range." />
      ) : (
        <svg role="img" aria-label={`Enquiries received per day over the last ${days} days: ${total} in total`} viewBox={`0 0 ${series.length * slot} 100`} preserveAspectRatio="none" className="h-36 w-full">
          <line x1={0} x2={series.length * slot} y1={99.5} y2={99.5} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {series.map((d, i) =>
            d.count > 0 ? (
              <rect key={d.day} x={i * slot + 1} width={slot - 2} y={96 - (d.count / max) * 90} height={(d.count / max) * 90 + 2} rx={1.5} className="fill-brand">
                <title>{`${d.label}: ${d.count}`}</title>
              </rect>
            ) : null,
          )}
        </svg>
      )}
    </ChartCard>
  );
}

const STAGE_COLOR: Record<PipelineStage, string> = { new: "bg-amber-400", progress: "bg-lime-500", qualified: "bg-brand", won: "bg-green-700", lost: "bg-red-400" };

/** Where the enquiries received in the range stand now, stage by stage, with the win rate of the closed ones. */
export function PipelineChart({ data }: { data: EnquiryCharts["pipeline"] }) {
  const max = Math.max(...PIPELINE_STAGES.map((s) => data.counts[s]), 1);
  return (
    <ChartCard
      title="Pipeline by stage"
      meta={<span className="num">{data.total.toLocaleString("en-US")} enquiries</span>}
      footer={
        <>
          Win rate (won ÷ won + lost):{" "}
          {data.winRate === null ? <span>Unknown, nothing closed yet</span> : <span className="num font-semibold text-foreground">{data.winRate}%</span>}
        </>
      }
    >
      {data.total === 0 ? (
        <EmptyState title="No enquiries in this period" description="Try a longer range." />
      ) : (
        <ul className="space-y-2.5">
          {PIPELINE_STAGES.map((stage) => (
            <li key={stage} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-xs">
              <span className="truncate text-muted-foreground">{PIPELINE_LABEL[stage]}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span className={cn("block h-full rounded-full", STAGE_COLOR[stage])} style={{ width: `${(data.counts[stage] / max) * 100}%` }} />
              </span>
              <span className="num text-right font-semibold">{data.counts[stage]}</span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

const BAND_LABEL: Record<FreshnessBand, string> = { fresh: "Under 24 hours", recent: "Under 7 days", aging: "Under 14 days", stale: "14 days or more" };
const BAND_COLOR: Record<FreshnessBand, string> = { fresh: "bg-green-600", recent: "bg-lime-400", aging: "bg-amber-400", stale: "bg-zinc-300" };

/** Age of the latest price for every product and supplier pair: how much of what we know is still current. */
export function FreshnessChart({ data }: { data: PriceFreshness }) {
  return (
    <ChartCard title="Supplier price freshness" meta={<span className="num">{data.total.toLocaleString("en-US")} prices</span>} footer="Age is from when the supplier stated the price, latest per product and supplier.">
      {data.total === 0 ? (
        <EmptyState title="No supplier prices yet" description="Confirmed broadcast items appear here." />
      ) : (
        <div className="space-y-4">
          <div role="img" aria-label="Share of latest supplier prices by age" className="flex h-3 overflow-hidden rounded-full bg-muted">
            {FRESHNESS_ORDER.map((band) => (data.counts[band] > 0 ? <span key={band} className={BAND_COLOR[band]} style={{ width: `${(data.counts[band] / data.total) * 100}%` }} /> : null))}
          </div>
          <ul className="space-y-1.5">
            {FRESHNESS_ORDER.map((band) => (
              <li key={band} className="flex items-center gap-2 text-xs">
                <span aria-hidden className={cn("size-2.5 rounded-full", BAND_COLOR[band])} />
                <span className="text-muted-foreground">{BAND_LABEL[band]}</span>
                <span className="num ml-auto font-semibold">{data.counts[band]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
