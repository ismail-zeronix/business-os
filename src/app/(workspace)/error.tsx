"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/application/states";
import { Button } from "@/components/ui/button";

/** Route-level error boundary. Shows a plain message; the real error is logged, never displayed (no stack traces or SQL). */
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This page could not be loaded"
      message="If this keeps happening, check that the database is running (npm run db:up)."
      action={
        <Button variant="outline" size="sm" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
