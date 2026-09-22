"use server";

import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { addCustomerContact, setCustomerContactStatus, updateCustomerContact } from "./contact.service";
import {
  customerContactCreateSchema,
  customerContactStatusSchema,
  customerContactUpdateSchema,
  customerCreateSchema,
  customerStatusSchema,
  customerUpdateSchema,
} from "./schemas";
import { createCustomer, setCustomerStatus, updateCustomer } from "./service";

/** Thin server actions: FormData -> zod -> service -> revalidate -> ActionResult. All business rules live in the services. */
type IdResult = ActionResult<{ id: string }>;

function revalidateCustomer(id: string) {
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function createCustomerAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = customerCreateSchema.parse(formDataToObject(formData));
      const customer = await createCustomer(await getServiceContext(), input);
      revalidatePath("/customers");
      return { id: customer.id };
    },
    { successMessage: "Customer created", formData },
  );
}

export async function updateCustomerAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = customerUpdateSchema.parse(formDataToObject(formData));
      const customer = await updateCustomer(await getServiceContext(), input);
      revalidateCustomer(customer.id);
      return { id: customer.id };
    },
    { successMessage: "Customer saved", formData },
  );
}

export async function setCustomerStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = customerStatusSchema.parse(formDataToObject(formData));
      await setCustomerStatus(await getServiceContext(), input);
      revalidateCustomer(input.id);
      return { id: input.id };
    },
    { successMessage: "Status updated", formData },
  );
}

export async function createCustomerContactAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = customerContactCreateSchema.parse(formDataToObject(formData));
      const contact = await addCustomerContact(await getServiceContext(), input);
      revalidateCustomer(input.customerId);
      return { id: contact.id };
    },
    { successMessage: "Contact added", formData },
  );
}

export async function updateCustomerContactAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = customerContactUpdateSchema.parse(formDataToObject(formData));
      const contact = await updateCustomerContact(await getServiceContext(), input);
      revalidateCustomer(contact.customerId);
      return { id: contact.id };
    },
    { successMessage: "Contact saved", formData },
  );
}

export async function setCustomerContactStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = customerContactStatusSchema.parse(formDataToObject(formData));
      const contact = await setCustomerContactStatus(await getServiceContext(), input);
      revalidateCustomer(contact.customerId);
      return { id: contact.id };
    },
    { successMessage: "Contact updated", formData },
  );
}
