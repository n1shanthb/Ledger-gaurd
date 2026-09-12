import { ConsoleNav } from "@/components/ConsoleNav";
import { KeeperAgentPanel } from "@/components/KeeperAgentPanel";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

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
            Multi-agent ops
          </h1>
          <p className="mt-4 max-w-2xl text-mute">
            Composer routes to Clerk, Market Solver, and Payer. Autopilot + Driver
            own pay-on-hit → fill (no LLM). Live graph is driven by SSE tool events
            — same decide/gate APIs as Compose. Master key never leaves Ledger;
            Key Ring holds keeper secrets.
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
