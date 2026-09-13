import { AppShell } from "@/components/AppShell";
import { ActivityTimeline } from "@/components/protect/ActivityTimeline";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchConsoleData } from "@/lib/subgraph";

export const dynamic = "force-dynamic";

export default async function ProtectActivityPage() {
  let error: string | null = null;
  let receipts: Awaited<ReturnType<typeof fetchConsoleData>>["executionReceipts"] =
    [];
  let kills: Awaited<ReturnType<typeof fetchConsoleData>>["killSwitches"] = [];
  let policies: Awaited<ReturnType<typeof fetchConsoleData>>["policies"] = [];
  let paymentAudits: Awaited<
    ReturnType<typeof fetchConsoleData>
  >["paymentAudits"] = [];

  try {
    const data = await fetchConsoleData();
    receipts = data.executionReceipts;
    kills = data.killSwitches;
    policies = data.policies;
    paymentAudits = data.paymentAudits ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Don't blank the page — on-chain pending rows still work in the timeline
    error = /429|rate limit|busy/i.test(msg)
      ? "Receipt Graph busy (429). Showing on-chain pending only — confirm Gateway URL for web Activity, then retry."
      : msg;
  }

  return (
    <>
      <AppShell
        eyebrow="Activity"
        title="Activity"
        subtitle="Indexed fills, kills, policies, and Hedera x402/HCS payment memos — plus on-chain pending while the indexer catches up."
      >
        <ActivityTimeline
          receipts={receipts}
          kills={kills}
          policies={policies}
          paymentAudits={paymentAudits}
          error={error}
        />
      </AppShell>
      <SiteFooter />
    </>
  );
}
