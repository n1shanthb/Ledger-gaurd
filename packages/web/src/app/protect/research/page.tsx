import { AppShell } from "@/components/AppShell";
import { ComposeProof } from "@/components/ComposeProof";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default function ProtectResearchPage() {
  return (
    <>
      <AppShell
        title="Market research"
        subtitle="Messari lending + DEX fan-out on The Graph Gateway — same decide path the keeper Solver uses for risk gates. Optional for Protect; load-bearing for Composable."
      >
        <ComposeProof />
      </AppShell>
      <SiteFooter />
    </>
  );
}
