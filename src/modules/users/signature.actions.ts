"use server";

import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { saveOwnSignature, signatureSchema } from "./signature.service";

/** Saves the signed-in person's own email signature. Nobody can change anyone else's: the service uses the actor's own id. */
export async function saveSignatureAction(_prev: ActionResult<{ signature: string | null }> | null, formData: FormData): Promise<ActionResult<{ signature: string | null }>> {
  return runAction(
    async () => {
      const saved = await saveOwnSignature(await getServiceContext(), signatureSchema.parse(formDataToObject(formData)));
      revalidatePath("/settings/email");
      return saved;
    },
    { successMessage: "Signature saved", formData },
  );
}
