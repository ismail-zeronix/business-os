import Link from "next/link";
import { EmptyState } from "@/components/application/states";
import { Button } from "@/components/ui/button";

/** Shown inside the app shell when a record does not exist (e.g. a supplier id that was never created). */
export default function WorkspaceNotFound() {
  return (
    <EmptyState
      title="Not found"
      description="This record does not exist or the link is out of date."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/">Go to Overview</Link>
        </Button>
      }
    />
  );
}
