"use server";

import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { addContact, setContactStatus, updateContact } from "./contact.service";
import {
  contactCreateSchema,
  contactStatusSchema,
  contactUpdateSchema,
  supplierAssociationsSchema,
  supplierCreateSchema,
  supplierStatusSchema,
  supplierUpdateSchema,
} from "./schemas";
import { createSupplier, setSupplierAssociations, setSupplierStatus, updateSupplier } from "./service";

/**
 * Thin server actions: FormData -> zod -> service -> revalidate -> ActionResult. All business rules live in the services.
 * Every action receives the previous state first because forms use useActionState.
 */
type IdResult = ActionResult<{ id: string }>;

function revalidateSupplier(id: string) {
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
}

export async function createSupplierAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = supplierCreateSchema.parse(formDataToObject(formData));
      const supplier = await createSupplier(await getServiceContext(), input);
      revalidatePath("/suppliers");
      return { id: supplier.id };
    },
    { successMessage: "Supplier created", formData },
  );
}

export async function updateSupplierAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = supplierUpdateSchema.parse(formDataToObject(formData));
      const supplier = await updateSupplier(await getServiceContext(), input);
      revalidateSupplier(supplier.id);
      return { id: supplier.id };
    },
    { successMessage: "Supplier saved", formData },
  );
}

export async function setSupplierStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = supplierStatusSchema.parse(formDataToObject(formData));
      await setSupplierStatus(await getServiceContext(), input);
      revalidateSupplier(input.id);
      return { id: input.id };
    },
    { successMessage: "Status updated", formData },
  );
}

export async function saveSupplierAssociationsAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = supplierAssociationsSchema.parse(formDataToObject(formData));
      await setSupplierAssociations(await getServiceContext(), input);
      revalidateSupplier(input.id);
      return { id: input.id };
    },
    { successMessage: "Brands and categories saved", formData },
  );
}

export async function createContactAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = contactCreateSchema.parse(formDataToObject(formData));
      const contact = await addContact(await getServiceContext(), input);
      revalidateSupplier(input.supplierId);
      return { id: contact.id };
    },
    { successMessage: "Contact added", formData },
  );
}

export async function updateContactAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = contactUpdateSchema.parse(formDataToObject(formData));
      const contact = await updateContact(await getServiceContext(), input);
      revalidateSupplier(contact.supplierId);
      return { id: contact.id };
    },
    { successMessage: "Contact saved", formData },
  );
}

export async function setContactStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = contactStatusSchema.parse(formDataToObject(formData));
      const contact = await setContactStatus(await getServiceContext(), input);
      revalidateSupplier(contact.supplierId);
      return { id: contact.id };
    },
    { successMessage: "Contact updated", formData },
  );
}
