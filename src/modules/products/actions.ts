"use server";

import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { aliasAddSchema, aliasRemoveSchema, productCreateSchema, productStatusSchema, productUpdateSchema } from "./schemas";
import { addAlias, createProduct, removeAlias, setProductStatus, updateProduct } from "./service";

/** Thin server actions for products and aliases: FormData -> zod -> service -> revalidate -> ActionResult. */
type IdResult = ActionResult<{ id: string }>;

function revalidateProduct(id: string) {
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

export async function createProductAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const product = await createProduct(await getServiceContext(), productCreateSchema.parse(formDataToObject(formData)));
      revalidatePath("/products");
      return { id: product.id };
    },
    { successMessage: "Product created", formData },
  );
}

export async function updateProductAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const product = await updateProduct(await getServiceContext(), productUpdateSchema.parse(formDataToObject(formData)));
      revalidateProduct(product.id);
      return { id: product.id };
    },
    { successMessage: "Product saved", formData },
  );
}

export async function setProductStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = productStatusSchema.parse(formDataToObject(formData));
      await setProductStatus(await getServiceContext(), input);
      revalidateProduct(input.id);
      return { id: input.id };
    },
    { successMessage: "Status updated", formData },
  );
}

export async function addAliasAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = aliasAddSchema.parse(formDataToObject(formData));
      const alias = await addAlias(await getServiceContext(), input);
      revalidateProduct(input.productId);
      return { id: alias.id };
    },
    { successMessage: "Alias added", formData },
  );
}

export async function removeAliasAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const removed = await removeAlias(await getServiceContext(), aliasRemoveSchema.parse(formDataToObject(formData)));
      revalidateProduct(removed.productId);
      return { id: removed.id };
    },
    { successMessage: "Alias removed", formData },
  );
}
