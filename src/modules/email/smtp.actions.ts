"use server";

import { revalidatePath } from "next/cache";
import { InvariantError } from "@/core/errors";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { createSmtpAccount, setSmtpAccountStatus, testSmtpAccount, updateSmtpAccount } from "./smtp-account.service";
import { smtpAccountCreateSchema, smtpAccountStatusSchema, smtpAccountTestSchema, smtpAccountUpdateSchema } from "./smtp.schemas";

/** Thin server actions for Settings > Email accounts > Outgoing. Admin-only rules live in the service. */
type IdResult = ActionResult<{ id: string }>;

const refresh = () => revalidatePath("/settings/email");

export async function createSmtpAccountAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const account = await createSmtpAccount(await getServiceContext(), smtpAccountCreateSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: account.id };
    },
    { successMessage: "Outgoing account added", formData },
  );
}

export async function updateSmtpAccountAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const account = await updateSmtpAccount(await getServiceContext(), smtpAccountUpdateSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: account.id };
    },
    { successMessage: "Outgoing account saved", formData },
  );
}

export async function setSmtpAccountStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const account = await setSmtpAccountStatus(await getServiceContext(), smtpAccountStatusSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: account.id };
    },
    { successMessage: "Status updated", formData },
  );
}

/** Sends one test message to the address typed. The result is shown, and remembered on the account. */
export async function testSmtpAccountAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = smtpAccountTestSchema.parse(formDataToObject(formData));
      const result = await testSmtpAccount(await getServiceContext(), input);
      refresh();
      if (!result.ok) throw new InvariantError(`The test message was not sent: ${result.message}`);
      return { id: input.id };
    },
    { successMessage: "Test message sent. Check the inbox.", formData },
  );
}
