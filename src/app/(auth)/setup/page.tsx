import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/core/database/client";
import { signInEnabled } from "@/core/permissions/actor";
import { SetupForm } from "@/modules/users/components/setup-form";

export const metadata: Metadata = { title: "Set up sign-in" };

/** One-time: available only while no active admin has a password. After that it always goes to the sign-in screen. */
export default async function SetupPage() {
  await connection();
  if (await signInEnabled()) redirect("/login");
  const existing = await db.user.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { name: true } });

  return (
    <>
      <h1 className="text-lg font-semibold">Set up sign-in</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Create the admin account. {existing ? `Everything done so far was recorded under "${existing.name}"; this account takes it over, so the history stays with you. ` : ""}
        After this, everyone signs in, and you can add colleagues under Settings.
      </p>
      <SetupForm defaultName="" defaultEmail="" />
    </>
  );
}
