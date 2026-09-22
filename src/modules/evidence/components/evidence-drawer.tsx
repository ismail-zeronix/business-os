import { z } from "zod";
import { EmptyState } from "@/components/application/states";
import { UrlSheet } from "@/components/application/url-sheet";
import { getObservationEvidence } from "@/modules/observations/procurement-queries";
import { EvidencePanel } from "./evidence-panel";

/**
 * Server-rendered evidence drawer for `?evidence=<observationId>`. Include it on any page that lists observations; pass the URL that
 * removes the param as `closeHref`. Renders nothing when there is no (valid) id.
 */
export async function EvidenceDrawer({ observationId, closeHref }: { observationId: string | undefined; closeHref: string }) {
  if (!observationId || !z.uuid().safeParse(observationId).success) return null;
  const data = await getObservationEvidence(observationId);
  return (
    <UrlSheet key={observationId} closeHref={closeHref} label="Evidence" title="Evidence" description="Where this value came from: the supplier, the original message and any corrections." width="38rem">
      {data ? <EvidencePanel data={data} /> : <EmptyState title="Evidence not found" description="This observation does not exist or the link is out of date." />}
    </UrlSheet>
  );
}
