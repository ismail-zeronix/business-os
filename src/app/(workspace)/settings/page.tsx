import { requireAdmin } from "@/core/permissions/actor";
import { redirect } from "next/navigation";
import { firstParam } from "@/lib/search-params";

/** /settings has no content of its own: it opens the first setting. The legacy `?tab=categories` link still lands on Categories. */
export default async function SettingsIndexPage(props: PageProps<"/settings">) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  redirect(firstParam(searchParams, "tab") === "categories" ? "/settings/categories" : "/settings/brands");
}
