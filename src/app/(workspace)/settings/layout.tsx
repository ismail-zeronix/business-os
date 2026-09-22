import { PageBody } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { SettingsNav } from "@/components/application/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <PageBody>
      <PageHeader title="Settings" subtitle="Master data and integrations used across the application." />
      <div className="flex items-start gap-6">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PageBody>
  );
}
