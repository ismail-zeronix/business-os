import { requireAdmin } from "@/core/permissions/actor";
import type { Metadata } from "next";
import { connection } from "next/server";
import { createBrandAction, renameBrandAction, setBrandStatusAction } from "@/modules/products/master-data.actions";
import { listBrands } from "@/modules/products/master-data.queries";
import { MasterDataPanel } from "@/modules/products/components/master-data-panel";

export const metadata: Metadata = { title: "Brands · Settings" };

export default async function BrandsSettingsPage() {
  await requireAdmin();
  await connection(); // live master data: never prerender it at build time
  return (
    <>
      <MasterDataPanel noun="brand" rows={await listBrands()} createAction={createBrandAction} renameAction={renameBrandAction} statusAction={setBrandStatusAction} />
    </>
  );
}
