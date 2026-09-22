import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { safeNextPath } from "@/core/auth/session";
import { getSessionActor, signInEnabled } from "@/core/permissions/actor";
import { firstParam } from "@/lib/search-params";
import { LoginForm } from "@/modules/users/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  await connection(); // reads who is signed in: never prerender it
  const next = firstParam(await props.searchParams, "next");
  if (!(await signInEnabled())) redirect("/setup"); // nobody has a password yet
  if (await getSessionActor()) redirect(safeNextPath(next)); // already signed in

  return (
    <>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">Use the email and password your admin set up for you.</p>
      <LoginForm next={next ? safeNextPath(next) : null} />
    </>
  );
}
