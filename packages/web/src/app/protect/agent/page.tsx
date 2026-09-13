import { AppShell } from "@/components/AppShell";
import { KeeperAgentPanel } from "@/components/KeeperAgentPanel";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default function ProtectAgentPage() {
  return (
    <>
      <AppShell
        eyebrow="Agent"
        title="Agent room"
        subtitle="Six roles: Composer, Clerk, Solver (AI) plus Payer, Autopilot, Driver (code). Clerk queries Receipt Graph; Solver uses Messari compose; Payer settles Hedera x402 — LLMs never hold the session key."
      >
        <KeeperAgentPanel />
      </AppShell>
      <SiteFooter />
    </>
  );
}
