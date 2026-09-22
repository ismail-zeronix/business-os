import type { Metadata } from "next";
import { connection } from "next/server";
import { Panel } from "@/components/application/page-canvas";
import { EmptyState } from "@/components/application/states";
import { Alert } from "@/components/ui/alert";
import { requireAdmin } from "@/core/permissions/actor";
import { isSecretKeyConfigured } from "@/core/security/secret-box";
import { AiExecutionsTable } from "@/modules/ai/components/executions-table";
import { AiProvidersTable } from "@/modules/ai/components/providers-table";
import { listProviderSettings, listRecentExecutions } from "@/modules/ai/queries";

export const metadata: Metadata = { title: "AI · Settings" };

/** Which AI provider answers the assistant, its model and key, and the latest runs. Admin only (ADR 0007). */
export default async function AiSettingsPage() {
  await requireAdmin();
  await connection(); // live settings and runs: never prerender at build time
  const [rows, executions] = await Promise.all([listProviderSettings(), listRecentExecutions()]);
  const keyConfigured = isSecretKeyConfigured();
  const active = rows.find((row) => row.isActive);

  return (
    <div className="space-y-4">
      <Alert className="bg-surface text-xs text-muted-foreground">
        The assistant answers from the application&apos;s own evidence (products, supplier prices and stock) and shows the sources behind every answer. It never
        changes a record and never sends a message. Each question and the evidence needed to answer it are sent to the active provider. Switching provider keeps
        the same checks and the same writing style.
        {active ? null : <span className="mt-1 block font-medium text-foreground">No provider is active, so the assistant is switched off.</span>}
      </Alert>

      <AiProvidersTable rows={rows} keyConfigured={keyConfigured} />

      <div className="space-y-2">
        <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Recent assistant runs</h2>
        {executions.length === 0 ? (
          <Panel>
            <EmptyState title="No questions asked yet" description="Every question is logged here with the provider, model and prompt version that answered it. Answers and prices are not stored." />
          </Panel>
        ) : (
          <AiExecutionsTable rows={executions} />
        )}
      </div>
    </div>
  );
}
