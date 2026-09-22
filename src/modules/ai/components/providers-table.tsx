import { Pencil, Plus } from "lucide-react";
import { SoftPill } from "@/components/application/soft-pill";
import { TableShell } from "@/components/data-table/table-shell";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { AI_PROVIDER_LABEL } from "@/lib/labels";
import { PROVIDER_ORDER } from "../provider-info";
import type { ProviderSettingRow } from "../queries";
import { AiProviderForm } from "./provider-form";
import { ProviderActiveControl } from "./provider-active-control";

/** The three providers, always listed: set up or not, and which one answers. Keys are never part of a row. */
export function AiProvidersTable({ rows, keyConfigured }: { rows: ProviderSettingRow[]; keyConfigured: boolean }) {
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  const active = rows.find((row) => row.isActive) ?? null;

  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Provider</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-40 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PROVIDER_ORDER.map((provider) => {
            const row = byProvider.get(provider);
            const label = AI_PROVIDER_LABEL[provider];
            return (
              <TableRow key={provider} className={row ? undefined : "text-muted-foreground"}>
                <TableCell className="font-medium">{label}</TableCell>
                <TableCell className="font-mono text-xs">{row?.model ?? "—"}</TableCell>
                <TableCell>
                  {row?.isActive ? (
                    <SoftPill tone="green" dot>
                      Active
                    </SoftPill>
                  ) : row ? (
                    <SoftPill>Ready</SoftPill>
                  ) : (
                    <span className="text-xs">Not set up</span>
                  )}
                </TableCell>
                <TableCell className="num text-xs">{row ? formatDateTime(row.updatedAt) : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <FormDrawer
                      trigger={
                        row ? (
                          <Button variant="ghost" size="icon" aria-label={`Edit ${label}`} title="Edit">
                            <Pencil aria-hidden />
                          </Button>
                        ) : (
                          <Button variant="outline" size="xs">
                            <Plus aria-hidden /> Set up
                          </Button>
                        )
                      }
                      title={row ? `Edit ${label}` : `Set up ${label}`}
                      description={row ? "The stored key is never shown. Leave it blank to keep it." : "Choose the model and enter an API key."}
                    >
                      <AiProviderForm provider={provider} setting={row ? { id: row.id, model: row.model } : undefined} keyConfigured={keyConfigured} />
                    </FormDrawer>
                    {row ? (
                      <ProviderActiveControl id={row.id} provider={provider} active={row.isActive} currentLabel={active && active.id !== row.id ? AI_PROVIDER_LABEL[active.provider] : null} />
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableShell>
  );
}
