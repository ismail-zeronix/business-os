import { cronSecretAccepted } from "@/core/auth/cron-secret";
import { getSystemContext } from "@/core/permissions/system-actor";
import { syncAllActiveAccounts } from "@/modules/email/sync.service";

/**
 * Triggered by the internal `mail-cron` compose service on an interval (see compose.yaml), not by a browser. Read-only with
 * respect to the mailbox and already bounded/incremental (`sync.service.ts`'s per-account cursor and lease) - this route
 * only adds the automatic trigger that production was missing; `scripts/mail-sync.ts` still works for local/manual use.
 * Deliberately outside sign-in (there is no session to check): authorized by MAIL_CRON_SECRET instead.
 */
export async function POST(request: Request) {
  if (!cronSecretAccepted(request.headers.get("x-cron-secret"))) {
    return Response.json({ status: "error", message: "Not authorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const outcomes = await syncAllActiveAccounts(await getSystemContext());
    return Response.json(
      {
        status: "ok",
        accounts: outcomes.map((o) => ({
          label: o.label,
          ingested: o.result?.ingested ?? 0,
          skipped: o.result?.skipped ?? 0,
          remaining: o.result?.remaining ?? false,
          error: o.result?.error ?? o.error,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ status: "error", message: error instanceof Error ? error.message : "Sync failed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
