import Link from "next/link";
import { ConsoleNav } from "@/components/ConsoleNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { STUDIO_URL, usdFrom1e8 } from "@/lib/constants";
import { fetchConsoleData } from "@/lib/subgraph";

export const dynamic = "force-dynamic";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default async function ReceiptsPage() {
  let error: string | null = null;
  let receipts: Awaited<ReturnType<typeof fetchConsoleData>>["executionReceipts"] =
    [];
  let kills: Awaited<ReturnType<typeof fetchConsoleData>>["killSwitches"] = [];

  try {
    const data = await fetchConsoleData();
    receipts = data.executionReceipts;
    kills = data.killSwitches;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-ink pt-24">
        <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">
            Receipts
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper md:text-5xl">
            Compliance log
          </h1>
          <p className="mt-4 max-w-2xl text-mute">
            Execution receipts and kill-switch events from Receipt Graph. Pyth
            spots are at fill time — Graph indexes compliance, not live prices.
          </p>
          <ConsoleNav />

          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs text-mute">
            <a
              href={STUDIO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-mist px-3 py-1.5 hover:border-signal hover:text-signal"
            >
              Studio →
            </a>
            <Link
              href="/console"
              className="rounded-full border border-mist px-3 py-1.5 hover:border-paper hover:text-paper"
            >
              ← Overview
            </Link>
          </div>

          {error && (
            <p className="mt-8 rounded-lg border border-kill/40 bg-kill/10 px-4 py-3 text-sm text-kill">
              Subgraph query failed: {error}
            </p>
          )}

          <section className="mt-12">
            <h2 className="font-display text-2xl text-paper">Execution receipts</h2>
            <div className="mt-6 overflow-x-auto border-t border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="font-mono text-xs uppercase tracking-wider text-mute">
                    <th className="py-3 pr-4 font-medium">Compliant</th>
                    <th className="py-3 pr-4 font-medium">Pyth</th>
                    <th className="py-3 pr-4 font-medium">Fill</th>
                    <th className="py-3 pr-4 font-medium">Owner</th>
                    <th className="py-3 font-medium">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length === 0 && !error && (
                    <tr>
                      <td colSpan={5} className="py-8 text-mute">
                        No fills indexed yet — set an active policy and run a
                        trigger.
                      </td>
                    </tr>
                  )}
                  {receipts.map((r) => (
                    <tr key={r.id} className="border-t border-line/80">
                      <td className="py-4 pr-4">
                        <span
                          className={
                            r.compliant
                              ? "font-mono text-xs text-signal"
                              : "font-mono text-xs text-kill"
                          }
                        >
                          {r.compliant ? "yes" : "no"}
                        </span>
                      </td>
                      <td className="py-4 pr-4 font-mono text-mute">
                        {usdFrom1e8(r.pythPrice)}
                      </td>
                      <td className="py-4 pr-4 font-mono text-mute">
                        {usdFrom1e8(r.executionPrice)}
                      </td>
                      <td className="py-4 pr-4 font-mono text-xs text-mute">
                        {shortAddr(r.owner)}
                      </td>
                      <td className="py-4">
                        <a
                          href={`https://basescan.org/tx/${r.txHash}`}
                          className="font-mono text-xs text-mute hover:text-signal"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortAddr(r.txHash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-16">
            <h2 className="font-display text-2xl text-paper">Kill switches</h2>
            <div className="mt-6 overflow-x-auto border-t border-line">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="font-mono text-xs uppercase tracking-wider text-mute">
                    <th className="py-3 pr-4 font-medium">Owner</th>
                    <th className="py-3 pr-4 font-medium">Revoked</th>
                    <th className="py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {kills.length === 0 && !error && (
                    <tr>
                      <td colSpan={3} className="py-8 text-mute">
                        No kill events yet.
                      </td>
                    </tr>
                  )}
                  {kills.map((k) => (
                    <tr key={k.id} className="border-t border-line/80">
                      <td className="py-4 pr-4 font-mono text-xs text-paper">
                        {shortAddr(k.owner)}
                      </td>
                      <td className="py-4 pr-4 text-kill">{k.policiesRevoked}</td>
                      <td className="py-4 font-mono text-xs text-mute">
                        {new Date(Number(k.timestamp) * 1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
