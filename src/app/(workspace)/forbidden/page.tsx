import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, Panel } from "@/components/application/page-canvas";
import { EmptyState } from "@/components/application/states";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/core/permissions/actor";

export const metadata: Metadata = { title: "Admin only" };

/** Where a Staff member lands when they open an admin-only screen. */
export default async function ForbiddenPage() {
  await requireActor();
  return (
    <PageBody>
      <Panel>
        <EmptyState
          title="Only an admin can open this"
          description="Your account can do all the day-to-day work. Users, mailbox connections and brand and category settings are managed by an admin."
          action={
            <Button asChild size="sm">
              <Link href="/">Back to the Overview</Link>
            </Button>
          }
        />
      </Panel>
    </PageBody>
  );
}
