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
        subtitle="Conversational ops around the protection spine. AI specialists draft and explain; Payer, Autopilot, and Driver are deterministic workers."
      >
        <KeeperAgentPanel />
      </AppShell>
      <SiteFooter />
    </>
  );
}
