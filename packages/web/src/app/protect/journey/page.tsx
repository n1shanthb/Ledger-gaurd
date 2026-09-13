import { AppShell } from "@/components/AppShell";
import { LedgerConsoleGate } from "@/components/LedgerConsoleGate";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default function ProtectJourneyPage() {
  return (
    <>
      <AppShell
        eyebrow="Protect"
        title="Clear-sign"
        subtitle="Guided journey from device to Receipt Graph. Master key never leaves Ledger."
      >
        <LedgerConsoleGate />
      </AppShell>
      <SiteFooter />
    </>
  );
}
