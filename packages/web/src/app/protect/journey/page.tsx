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
        subtitle="Clear-sign on Ledger OLED, then unplug. The keeper loads live policies from Receipt Graph, pays x402 to attempt, and indexes outcomes you can audit."
      >
        <LedgerConsoleGate />
      </AppShell>
      <SiteFooter />
    </>
  );
}
