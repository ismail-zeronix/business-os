"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { NotFoundError, ValidationError } from "@/core/errors";
import { getServiceContext } from "@/core/permissions/actor";
import { assertAdmin } from "@/core/permissions/roles";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { decryptSecret } from "@/core/security/secret-box";
import { createEmailAccount, setEmailAccountStatus, updateEmailAccount } from "./account.service";
import { testImapConnection } from "./imap";
import { getEmailAccountForSync, getEmailAccountSyncStatus, type SyncStatusRow } from "./queries";
import { emailAccountCreateSchema, emailAccountStatusSchema, emailAccountTestSchema, emailAccountUpdateSchema, emailAssignSchema, emailDismissSchema, emailIdSchema, emailSyncSchema } from "./schemas";
import { claimSync, runClaimedSync } from "./sync.service";
import { assignEmailMessage, createEnquiryFromEmail, dismissEmail, restoreEmail } from "./triage.service";

/**
 * Thin server actions for mailbox accounts. SECURITY: `runAction` echoes the submitted values back to the browser when a form fails,
 * so the password is stripped from the FormData first (`withoutPassword`): it must never be sent back.
 */
type IdResult = ActionResult<{ id: string }>;

function withoutPassword(formData: FormData): FormData {
  const safe = new FormData();
  for (const [key, value] of formData.entries()) if (key !== "password") safe.append(key, value);
  return safe;
}

const refresh = () => revalidatePath("/settings/email");

export async function createEmailAccountAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = emailAccountCreateSchema.parse(formDataToObject(formData));
      const account = await createEmailAccount(await getServiceContext(), input);
      refresh();
      return { id: account.id };
    },
    { successMessage: "Email account added", formData: withoutPassword(formData) },
  );
}

export async function updateEmailAccountAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = emailAccountUpdateSchema.parse(formDataToObject(formData));
      const account = await updateEmailAccount(await getServiceContext(), input);
      refresh();
      return { id: account.id };
    },
    { successMessage: "Email account saved", formData: withoutPassword(formData) },
  );
}

export async function setEmailAccountStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = emailAccountStatusSchema.parse(formDataToObject(formData));
      await setEmailAccountStatus(await getServiceContext(), input);
      refresh();
      return { id: input.id };
    },
    { successMessage: "Status updated", formData },
  );
}

type TestResult = ActionResult<{ messageCount: number }>;

/**
 * "Test connection" for the form as filled in. On an existing account a blank password means "use the stored one" (decrypted here, in
 * memory, and never returned). Stores nothing. A failure returns one fixed, sanitised sentence.
 */
export async function testEmailConnectionAction(_prev: TestResult | null, formData: FormData): Promise<TestResult> {
  return runAction(
    async () => {
      assertAdmin(await getServiceContext()); // it can use the stored mailbox password: admin only, like the rest of the mailbox settings
      const input = emailAccountTestSchema.parse(formDataToObject(formData));
      let password = input.password;
      if (password === undefined && input.id) {
        const stored = await getEmailAccountForSync(input.id);
        if (!stored) throw new NotFoundError("Email account");
        password = decryptSecret(stored.passwordEncrypted);
      }
      if (password === undefined) {
        throw new ValidationError("Enter the mailbox password to test the connection.", { password: "Enter the password" });
      }
      const result = await testImapConnection({ host: input.host, port: input.port, security: input.security, username: input.username, password, folder: input.folder });
      if (!result.ok) {
        throw new ValidationError(result.message);
      }
      return { messageCount: result.messageCount };
    },
    { successMessage: "Connection works", formData: withoutPassword(formData) },
  );
}

// ───────────────────────────────────────── sync ─────────────────────────────────────────

type SyncActionResult = ActionResult<{ started: true }>;

/**
 * "Sync now": claims the account's sync lease (fast - fails immediately with a clear message if one is already running, exactly as
 * before) and returns right away; the slow part (the actual IMAP read and store, up to MAX_PER_RUN messages) keeps running in the
 * background via `after()` so this request does not stay open for it and the button does not sit "Syncing..." for minutes on a
 * large mailbox. `SyncMailButton` polls `getEmailSyncStatusAction` to learn when it finishes and show the real result.
 */
export async function syncEmailAccountAction(_prev: SyncActionResult | null, formData: FormData): Promise<SyncActionResult> {
  return runAction(async () => {
    const { id } = emailSyncSchema.parse(formDataToObject(formData));
    const ctx = await getServiceContext();
    const account = await claimSync(ctx, id);
    after(async () => {
      await runClaimedSync(ctx, id, account);
      revalidatePath("/enquiries");
      revalidatePath("/settings/email");
      revalidatePath("/", "layout");
    });
    return { started: true as const };
  });
}

/** Polled by `SyncMailButton` after it starts a background sync, to show the real result once it finishes. Read-only. */
export async function getEmailSyncStatusAction(accountId: string): Promise<SyncStatusRow | null> {
  return getEmailAccountSyncStatus(accountId);
}

// ───────────────────────────────────────── triage ─────────────────────────────────────────

/** Creates an enquiry from an email (a person's decision) and returns the new enquiry's id so the UI can open it. */
export async function createEnquiryFromEmailAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const { id } = emailIdSchema.parse(formDataToObject(formData));
      const { enquiryId } = await createEnquiryFromEmail(await getServiceContext(), id);
      revalidatePath("/enquiries");
      revalidatePath("/", "layout");
      return { id: enquiryId };
    },
    { successMessage: "Enquiry created from the email. Review the requirements.", formData },
  );
}

export async function dismissEmailAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const result = await dismissEmail(await getServiceContext(), emailDismissSchema.parse(formDataToObject(formData)));
      revalidatePath("/enquiries");
      revalidatePath("/", "layout");
      return result;
    },
    { successMessage: "Email dismissed", formData },
  );
}

export async function restoreEmailAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const result = await restoreEmail(await getServiceContext(), emailIdSchema.parse(formDataToObject(formData)));
      revalidatePath("/enquiries");
      revalidatePath("/", "layout");
      return result;
    },
    { successMessage: "Email restored to the queue", formData },
  );
}

/** Advisory only: assigning an email never hides it from anyone else. Empty "assignedToId" unassigns. */
export async function assignEmailMessageAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const result = await assignEmailMessage(await getServiceContext(), emailAssignSchema.parse(formDataToObject(formData)));
      revalidatePath("/enquiries");
      return result;
    },
    { successMessage: "Assignment updated", formData },
  );
}
