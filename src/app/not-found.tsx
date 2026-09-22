import Link from "next/link";
import { EmptyState } from "@/components/application/states";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <EmptyState
        title="Page not found"
        description="The page you are looking for does not exist or has been moved."
        action={
          <Button asChild size="sm">
            <Link href="/">Go to Overview</Link>
          </Button>
        }
      />
    </div>
  );
}
