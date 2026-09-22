"use server";

import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { masterDataCreateSchema, masterDataRenameSchema, masterDataStatusSchema } from "./master-data.schemas";
import {
  createBrand,
  createCategory,
  renameBrand,
  renameCategory,
  setBrandStatus,
  setCategoryStatus,
} from "./master-data.service";

/** Brand and Category server actions (Settings screen). Thin: FormData -> zod -> service -> revalidate. */
type IdResult = ActionResult<{ id: string }>;
const refresh = () => revalidatePath("/settings", "layout");

export async function createBrandAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const brand = await createBrand(await getServiceContext(), masterDataCreateSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: brand.id };
    },
    { successMessage: "Brand added", formData },
  );
}

export async function renameBrandAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const brand = await renameBrand(await getServiceContext(), masterDataRenameSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: brand.id };
    },
    { successMessage: "Brand renamed", formData },
  );
}

export async function setBrandStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const brand = await setBrandStatus(await getServiceContext(), masterDataStatusSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: brand.id };
    },
    { successMessage: "Status updated", formData },
  );
}

export async function createCategoryAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const category = await createCategory(await getServiceContext(), masterDataCreateSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: category.id };
    },
    { successMessage: "Category added", formData },
  );
}

export async function renameCategoryAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const category = await renameCategory(await getServiceContext(), masterDataRenameSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: category.id };
    },
    { successMessage: "Category renamed", formData },
  );
}

export async function setCategoryStatusAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const category = await setCategoryStatus(await getServiceContext(), masterDataStatusSchema.parse(formDataToObject(formData)));
      refresh();
      return { id: category.id };
    },
    { successMessage: "Status updated", formData },
  );
}
