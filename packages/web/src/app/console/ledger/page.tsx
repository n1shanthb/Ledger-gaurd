import { ConsoleNav } from "@/components/ConsoleNav";
import { LedgerConsoleGate } from "@/components/LedgerConsoleGate";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default function LedgerConsolePage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-ink pt-24">
        <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">
            Ledger
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper md:text-5xl">
            Clear-sign
          </h1>
          <p className="mt-4 max-w-2xl text-mute">
            Connect Ledger, set Guardian policies, kill delegation. Master key
            never leaves the device.
          </p>
          <ConsoleNav />
          <LedgerConsoleGate />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
