import { SoftPill } from "@/components/application/soft-pill";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { AI_PROVIDER_LABEL } from "@/lib/labels";
import type { ExecutionRow } from "../queries";

const levelOf = (score: number) => (score >= 0.85 ? "High" : score >= 0.6 ? "Medium" : "Low");

/** The latest assistant runs: who asked, which provider and prompt version answered, how it went. No answer text or prices are kept. */
export function AiExecutionsTable({ rows }: { rows: ExecutionRow[] }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>When</TableHead>
            <TableHead>Person</TableHead>
            <TableHead>Question</TableHead>
            <TableHead>Answered by</TableHead>
            <TableHead>Result</TableHead>
            <TableHead className="text-right">Confidence</TableHead>
            <TableHead className="text-right">Time</TableHead>
            <TableHead className="text-right" title="Input / output tokens. The grey line is the part of the input read from, or written to, the provider's prompt cache.">
              Tokens in / out
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="num text-xs" title={formatDateTime(row.createdAt)}>
                {formatRelativeAge(row.createdAt, now)}
              </TableCell>
              <TableCell className="text-xs">{row.actorName}</TableCell>
              <TableCell className="max-w-72">
                <span className="block truncate text-xs" title={row.inputSummary}>
                  {row.inputSummary}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {row.intent}
                  {row.outputSummary ? ` · ${row.outputSummary}` : ""}
                </span>
              </TableCell>
              <TableCell className="text-xs">
                {row.provider ? (
                  <>
                    <span className="block">{AI_PROVIDER_LABEL[row.provider]}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {row.model} · {row.promptVersion}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Rules only</span>
                )}
              </TableCell>
              <TableCell>
                {row.status === "SUCCEEDED" ? (
                  <SoftPill tone="green">{row.repairAttempted ? "Answered after a retry" : "Answered"}</SoftPill>
                ) : (
                  <SoftPill tone="red" title={row.errorCode ?? undefined}>
                    Failed · {row.errorCode}
                  </SoftPill>
                )}
              </TableCell>
              <TableCell className="num text-right text-xs">{row.confidenceScore === null ? "—" : `${Math.round(row.confidenceScore * 100)}% ${levelOf(row.confidenceScore)}`}</TableCell>
              <TableCell className="num text-right text-xs">{(row.latencyMs / 1000).toFixed(1)} s</TableCell>
              <TableCell className="num text-right text-xs">
                {row.inputTokens === null && row.outputTokens === null ? (
                  "—"
                ) : (
                  <>
                    <span className="block">{`${(row.inputTokens ?? 0).toLocaleString("en-US")} / ${(row.outputTokens ?? 0).toLocaleString("en-US")}`}</span>
                    {row.cacheReadTokens || row.cacheWriteTokens ? (
                      <span className="block text-[11px] text-muted-foreground">
                        {row.cacheReadTokens ? `${row.cacheReadTokens.toLocaleString("en-US")} from cache` : `${(row.cacheWriteTokens ?? 0).toLocaleString("en-US")} cached`}
                      </span>
                    ) : null}
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
