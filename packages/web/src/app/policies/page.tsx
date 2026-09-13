import { AppShell } from "@/components/AppShell";
import { PoliciesExplorer } from "@/components/PoliciesExplorer";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default function ProtectionsPage() {
  return (
    <>
      <AppShell
        eyebrow="Protections"
        title="Protections"
        subtitle="Your clear-signed policies with status and next actions. Global index is available as a judge/explorer view."
      >
        <PoliciesExplorer />
      </AppShell>
      <SiteFooter />
    </>
  );
}
