import Link from "next/link";
import { cookies } from "next/headers";
import { ShellProvider } from "@/components/application/shell-context";
import { AppSidebar } from "@/components/application/sidebar";
import { Topbar } from "@/components/application/topbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { requireActorOrNull, signInEnabled } from "@/core/permissions/actor";
import { countBroadcastsAwaitingReview } from "@/modules/broadcasts/queries";
import { countEnquiriesNeedingAttention } from "@/modules/enquiries/queries";

/** The shell must still render if the database is down: each piece of shell data fails on its own, and pages show the real error themselves. */
async function safely<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work;
  } catch {
    return null;
  }
}

/**
 * The application shell, on the shadcn sidebar: a deep green sidebar and a canvas-coloured top navbar frame the content, and
 * only the content scrolls. The layout adds no padding: list pages fill the frame with a flush panel, record pages add their own gutter
 * (PageBody). The sidebar counts are real (enquiries and broadcasts waiting for a person) and refresh when an action revalidates the
 * layout. Whether the sidebar is open is remembered in the `sidebar_open` cookie (collapsed when there is none) that shadcn's provider writes.
 *
 * Sign-in: the layout asks who is acting FIRST (a redirect to /login when sign-in is on and nobody is signed in), so nothing is drawn or
 * fetched for a stranger. It is not re-run on client navigation, so every page checks for itself as well (`requireActor`).
 */
export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const actor = await requireActorOrNull();
  const [signInOn, attention, awaiting, cookieStore] = await Promise.all([
    safely(signInEnabled()),
    safely(countEnquiriesNeedingAttention()),
    safely(countBroadcastsAwaitingReview()),
    cookies(),
  ]);
  const account = actor ? { name: actor.name, email: actor.email, role: actor.role } : null;
  const signedIn = signInOn === true && account !== null;
  const sidebarOpen = cookieStore.get("sidebar_open")?.value === "true"; // collapsed until a person opens it

  return (
    <ShellProvider>
      <SidebarProvider defaultOpen={sidebarOpen} className="h-svh overflow-hidden">
        <AppSidebar account={account} signedIn={signedIn} counts={{ "/enquiries": attention ?? 0, "/broadcasts": awaiting ?? 0 }} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar account={account} signedIn={signedIn} attention={attention ?? 0} />
          {signInOn === false ? (
            <div role="status" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning-border bg-warning-bg px-6 py-1.5 text-xs text-warning">
              <span>Sign-in is not set up: anyone who can reach this application has full access.</span>
              <Link href="/setup" className="font-medium underline">
                Set up sign-in
              </Link>
            </div>
          ) : null}
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas">{children}</main>
        </div>
      </SidebarProvider>
    </ShellProvider>
  );
}
