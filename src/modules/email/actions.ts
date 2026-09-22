"use server";

import { revalidatePath } from "next/cache";
import { NotFoundError, ValidationError } from "@/core/errors";
import { getServiceContext } from "@/core/permissions/actor";
import { assertAdmin } from "@/core/permissions/roles";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { decryptSecret } from "@/core/security/secret-box";
import { createEmailAccount, setEmailAccountStatus, updateEmailAccount } from "./account.service";
import { testImapConnection } from "./imap";
import { getEmailAccountForSync } from "./queries";
import { emailAccountCreateSchema, emailAccountStatusSchema, emailAccountTestSchema, emailAccountUpdateSchema, emailDismissSchema, emailIdSchema, emailSyncSchema } from "./schemas";
import { syncAccount, type SyncResult } from "./sync.service";
import { createEnquiryFromEmail, dismissEmail, restoreEmail } from "./triage.service";

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

type SyncActionResult = ActionResult<SyncResult>;

/**
 * "Sync now": reads new mail from one account (read-only) and stores it for triage. A problem talking to the server is returned in
 * `data.error` (a short sanitised sentence), together with whatever was ingested before it, so the button can report both.
 */
export async function syncEmailAccountAction(_prev: SyncActionResult | null, formData: FormData): Promise<SyncActionResult> {
  return runAction(async () => {
    const { id } = emailSyncSchema.parse(formDataToObject(formData));
    const result = await syncAccount(await getServiceContext(), id);
    revalidatePath("/enquiries");
    revalidatePath("/settings/email");
    revalidatePath("/", "layout");
    return result;
  });
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
