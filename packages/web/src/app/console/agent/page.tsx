import { ConsoleNav } from "@/components/ConsoleNav";
import { KeeperAgentPanel } from "@/components/KeeperAgentPanel";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function AgentPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-ink pt-24">
        <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">
            Agent
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper md:text-5xl">
            Keeper agent
          </h1>
          <p className="mt-4 max-w-2xl text-mute">
            OpenRouter via Key Ring. Messari gate tools before x402{" "}
            <code className="text-paper">/trigger</code>. Policies still
            clear-sign on Ledger.
          </p>
          <ConsoleNav />
          <div className="mt-10">
            <KeeperAgentPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
