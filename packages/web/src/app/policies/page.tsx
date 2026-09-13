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
        subtitle="Clear-signed policies with status and next actions. Backed by the live Receipt Graph index (owner filter when your Ledger address is connected)."
      >
        <PoliciesExplorer />
      </AppShell>
      <SiteFooter />
    </>
  );
}
