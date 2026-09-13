import { AppShell } from "@/components/AppShell";
import { ComposeProof } from "@/components/ComposeProof";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default function ProtectResearchPage() {
  return (
    <>
      <AppShell
        title="Market research"
        subtitle="Advanced Messari-backed decision surface. Not required for the core Protect journey."
      >
        <ComposeProof />
      </AppShell>
      <SiteFooter />
    </>
  );
}
