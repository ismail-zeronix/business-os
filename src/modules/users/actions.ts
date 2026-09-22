"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeNextPath, sessionCookieOptions } from "@/core/auth/session";
import { getServiceContext, signInEnabled } from "@/core/permissions/actor";
import { ConflictError } from "@/core/errors";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { changeOwnPassword, setupFirstAdmin, signIn, signOut } from "./auth.service";
import { changePasswordSchema, setupSchema, signInSchema, userCreateSchema, userPasswordResetSchema, userStatusSchema, userUpdateSchema } from "./schemas";
import { createUser, resetUserPassword, setUserStatus, updateUser } from "./service";

/**
 * Thin server actions for signing in and for user management: FormData -> zod -> service -> ActionResult. Rules live in the services.
 * A password is NEVER sent back to the browser, not even to refill a form after an error: only the named fields are echoed.
 */
type IdResult = ActionResult<{ id: string }>;
type NoData = ActionResult<null>;

/** The form values echoed after a failed submit (so a person does not retype), without any password field. */
function echo(formData: FormData, ...keep: string[]): FormData {
  const safe = new FormData();
  for (const key of keep) {
    const value = formData.get(key);
    if (typeof value === "string") safe.set(key, value);
  }
  return safe;
}

async function startSession(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function signInAction(_prev: NoData | null, formData: FormData): Promise<NoData> {
  return runAction(
    async () => {
      const input = signInSchema.parse(formDataToObject(formData));
      const session = await signIn({ email: input.email, password: input.password });
      await startSession(session.token, session.expiresAt);
      redirect(safeNextPath(input.next));
    },
    { formData: echo(formData, "email", "next") },
  );
}

export async function setupAction(_prev: NoData | null, formData: FormData): Promise<NoData> {
  return runAction(
    async () => {
      if (await signInEnabled()) throw new ConflictError("Sign-in is already set up. Please sign in.");
      const input = setupSchema.parse(formDataToObject(formData));
      const session = await setupFirstAdmin({ name: input.name, email: input.email, password: input.password });
      await startSession(session.token, session.expiresAt);
      redirect("/");
    },
    { formData: echo(formData, "name", "email") },
  );
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await signOut(token);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePasswordAction(_prev: NoData | null, formData: FormData): Promise<NoData> {
  return runAction(
    async () => {
      const input = changePasswordSchema.parse(formDataToObject(formData));
      const keep = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
      await changeOwnPassword(await getServiceContext(), { currentPassword: input.currentPassword, newPassword: input.newPassword }, keep);
      return null;
    },
    { successMessage: "Password changed. Your other sessions were signed out.", formData: echo(formData) },
  );
}

// ───────────────────────────────────────── user management (admin) ─────────────────────────────────────────

function refreshUsers() {
  revalidatePath("/settings/users");
}

export async function createUserAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const user = await createUser(await getServiceContext(), userCreateSchema.parse(formDataToObject(formData)));
      refreshUsers();
      return user;
    },
    { successMessage: "User added", formData: echo(formData, "name", "email", "role") },
  );
}

export async function updateUserAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const user = await updateUser(await getServiceContext(), userUpdateSchema.parse(formDataToObject(formData)));
      refreshUsers();
      return user;
    },
    { successMessage: "User saved", formData: echo(formData, "id", "name", "email", "role") },
  );
}

export async function resetUserPasswordAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const user = await resetUserPassword(await getServiceContext(), userPasswordResetSchema.parse(formDataToObject(formData)));
      refreshUsers();
      return user;
    },
    { successMessage: "Password reset. The person was signed out everywhere.", formData: echo(formData, "id") },
  );
}

export async function setUserStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const user = await setUserStatus(await getServiceContext(), userStatusSchema.parse(formDataToObject(formData)));
      refreshUsers();
      return user;
    },
    { successMessage: "User updated", formData: echo(formData, "id", "status") },
  );
}
