import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SiteFooter } from "@/components/SiteFooter";
import { EmptyState } from "@/components/ui/Panel";
import { EXPLORER_URL, STUDIO_URL, tokenLabel, usdFrom1e8 } from "@/lib/constants";
import { fetchConsoleData } from "@/lib/subgraph";
import { ProtectOverviewClient } from "@/components/protect/ProtectOverviewClient";

export const dynamic = "force-dynamic";

function policyTypeLabel(t: string | number) {
  const s = String(t);
  if (s === "1" || s === "TAKE_PROFIT") return "Take-profit";
  if (s === "2" || s === "LP_STOP_LOSS") return "LP stop-loss";
  if (s === "3" || s === "BUY_DIP") return "Buy-dip";
  return "Stop-loss";
}

export default async function ProtectOverviewPage() {
  let error: string | null = null;
  let policies: Awaited<ReturnType<typeof fetchConsoleData>>["policies"] = [];
  let receipts: Awaited<ReturnType<typeof fetchConsoleData>>["executionReceipts"] =
    [];
  let kills: Awaited<ReturnType<typeof fetchConsoleData>>["killSwitches"] = [];

  try {
    const data = await fetchConsoleData();
    policies = data.policies;
    receipts = data.executionReceipts;
    kills = data.killSwitches;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const active = policies.filter((p) => p.active);
  const recent = receipts.slice(0, 5);

  return (
    <>
      <AppShell
        eyebrow="Overview"
        title="Your protection status"
        subtitle="Connect Ledger, clear-sign a protection, let Autopilot watch Receipt Graph + Pyth, then verify fills, kills, and audits in Activity — Graph is how the keeper knows what is live."
      >
        <ProtectOverviewClient />

        {error && (
          <p className="mt-8 border-l-2 border-kill/50 pl-4 text-sm text-kill">
            Receipt Graph query failed — {error}. Activity may lag until the
            indexer catches Base; Basescan still shows your clear-sign.
          </p>
        )}

        <section className="mt-16 grid gap-14 lg:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="font-display text-xl text-paper">Active protections</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                {active.length} live
              </span>
            </div>
            {active.length === 0 ? (
              <EmptyState
                title="No active protections"
                body={
                  recent.length > 0
                    ? "Your last policy already filled — one-shot protections deactivate after execute. Open Activity for the receipt, or create a new protection."
                    : "Create a protection with clear-sign. Empty here is normal until you finish the journey."
                }
                action={
                  <div className="flex flex-wrap gap-3">
                    {recent.length > 0 && (
                      <Link
                        href="/protect/activity"
                        className="inline-flex rounded-full border border-mist px-5 py-2.5 text-sm text-paper transition hover:border-paper"
                      >
                        See fill
                      </Link>
                    )}
                    <Link
                      href="/protect/journey"
                      className="inline-flex rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-signal"
                    >
                      Create protection
                    </Link>
                  </div>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {active.slice(0, 6).map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm"
                  >
                    <span className="text-paper">{policyTypeLabel(p.policyType)}</span>
                    <span className="font-mono text-xs text-mute">
                      {tokenLabel(p.token)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="font-display text-xl text-paper">Latest activity</h2>
              <Link
                href="/protect/activity"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal hover:underline"
              >
                All →
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {recent.length === 0 && !error && (
                <li className="py-8 text-sm text-mute">
                  No verified fills yet. Payments alone will not show here.
                </li>
              )}
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm"
                >
                  <span
                    className={
                      r.compliant
                        ? "font-mono text-xs text-signal"
                        : "font-mono text-xs text-kill"
                    }
                  >
                    {r.compliant ? "fill ok" : "flagged"}
                  </span>
                  <span className="font-mono text-xs text-mute">
                    Pyth {usdFrom1e8(r.pythPrice)}
                  </span>
                </li>
              ))}
              {kills[0] && (
                <li className="py-4 text-sm text-kill">
                  Recent kill indexed · see Activity
                </li>
              )}
            </ul>
            <div className="mt-6 flex flex-wrap gap-4 font-mono text-[11px] text-mute">
              <a
                href={EXPLORER_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-signal"
              >
                Explorer →
              </a>
              <a
                href={STUDIO_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-signal"
              >
                Studio →
              </a>
            </div>
          </div>
        </section>
      </AppShell>
      <SiteFooter />
    </>
  );
}
