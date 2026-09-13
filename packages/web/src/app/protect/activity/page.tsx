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

  try {
    const data = await fetchConsoleData();
    receipts = data.executionReceipts;
    kills = data.killSwitches;
    policies = data.policies;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Don't blank the page — on-chain pending rows still work in the timeline
    error = /429|rate limit|busy/i.test(msg)
      ? "Receipt Graph busy (429). Showing on-chain pending only — restart web if still on Studio URL; Gateway should be live."
      : msg;
  }

  return (
    <>
      <AppShell
        eyebrow="Activity"
        title="Activity"
        subtitle="Fills, kill events, and indexed policy changes. Click a row for bands, trigger, and fill price. Payments without execution are labeled separately in Agent room."
      >
        <ActivityTimeline
          receipts={receipts}
          kills={kills}
          policies={policies}
          error={error}
        />
      </AppShell>
      <SiteFooter />
    </>
  );
}
