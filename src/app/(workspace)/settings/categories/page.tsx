import { requireAdmin } from "@/core/permissions/actor";
import type { Metadata } from "next";
import { connection } from "next/server";
import { createCategoryAction, renameCategoryAction, setCategoryStatusAction } from "@/modules/products/master-data.actions";
import { listCategories } from "@/modules/products/master-data.queries";
import { MasterDataPanel } from "@/modules/products/components/master-data-panel";

export const metadata: Metadata = { title: "Categories · Settings" };

export default async function CategoriesSettingsPage() {
  await requireAdmin();
  await connection(); // live master data: never prerender it at build time
  return (
    <>
      <MasterDataPanel noun="category" rows={await listCategories()} createAction={createCategoryAction} renameAction={renameCategoryAction} statusAction={setCategoryStatusAction} />
    </>
  );
}
