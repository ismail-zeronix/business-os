import type { Metadata } from "next";
import { EmptyState } from "@/components/application/states";
import { requireActor } from "@/core/permissions/actor";

export const metadata: Metadata = { title: "Knowledge" };

export default async function KnowledgePage() {
  await requireActor();
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center bg-background">
      <EmptyState title="Pick a page" description="Open a folder in the explorer, then choose a page to read it." />
    </div>
  );
}
