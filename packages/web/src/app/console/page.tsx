import Link from "next/link";
import { LedgerConsoleGate } from "@/components/LedgerConsoleGate";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  GPM_V2,
  STUDIO_URL,
  tokenLabel,
  usdFrom1e8,
} from "@/lib/constants";
import { fetchConsoleData } from "@/lib/subgraph";

export const dynamic = "force-dynamic";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function policyTypeLabel(t: string | number) {
  const s = String(t);
  if (s === "1" || s === "TAKE_PROFIT") return "Take-profit";
  if (s === "2" || s === "LP_STOP_LOSS") return "LP stop-loss";
  if (s === "3" || s === "BUY_DIP") return "Buy-dip";
  return "Stop-loss";
}

export default async function ConsolePage() {
  let error: string | null = null;
  let policies: Awaited<ReturnType<typeof fetchConsoleData>>["policies"] = [];
  let receipts: Awaited<ReturnType<typeof fetchConsoleData>>["executionReceipts"] = [];
  let kills: Awaited<ReturnType<typeof fetchConsoleData>>["killSwitches"] = [];

  try {
    const data = await fetchConsoleData();
    policies = data.policies;
    receipts = data.executionReceipts;
    kills = data.killSwitches;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const active = policies.filter((p) => p.active).length;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-ink pt-24">
        <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">Console</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper md:text-5xl">
            Receipt Graph
          </h1>
          <p className="mt-4 max-w-2xl text-mute">
            Live policies, kills, and execution receipts from Subgraph Studio. Prices come from
            Pyth at fill time — Graph indexes compliance, not spots.
          </p>

          <div className="mt-8 flex flex-wrap gap-3 font-mono text-xs text-mute">
            <span className="rounded-full border border-mist px-3 py-1.5">
              GPM {shortAddr(GPM_V2)}
            </span>
            <span className="rounded-full border border-mist px-3 py-1.5">
              {active} active · {policies.length} total
            </span>
            <a
              href={STUDIO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-mist px-3 py-1.5 hover:border-signal hover:text-signal"
            >
              Studio →
            </a>
            <Link
              href="/"
              className="rounded-full border border-mist px-3 py-1.5 hover:border-paper hover:text-paper"
            >
              ← Protocol
            </Link>
          </div>

          <LedgerConsoleGate />

          {error && (
            <p className="mt-10 rounded-lg border border-kill/40 bg-kill/10 px-4 py-3 text-sm text-kill">
              Subgraph query failed: {error}
            </p>
          )}

          <section className="mt-14">
            <h2 className="font-display text-2xl text-paper">Policies</h2>
            <div className="mt-6 overflow-x-auto border-t border-line">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="font-mono text-xs uppercase tracking-wider text-mute">
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium">Type</th>
                    <th className="py-3 pr-4 font-medium">Token</th>
                    <th className="py-3 pr-4 font-medium">Stop</th>
                    <th className="py-3 pr-4 font-medium">Take</th>
                    <th className="py-3 font-medium">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.length === 0 && !error && (
                    <tr>
                      <td colSpan={6} className="py-8 text-mute">
                        No policies indexed yet.
                      </td>
                    </tr>
                  )}
                  {policies.map((p) => (
                    <tr key={p.id} className="border-t border-line/80">
                      <td className="py-4 pr-4">
                        <span
                          className={
                            p.active
                              ? "font-mono text-xs text-signal"
                              : "font-mono text-xs text-mute"
                          }
                        >
                          {p.active ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-paper">{policyTypeLabel(p.policyType)}</td>
                      <td className="py-4 pr-4 text-paper">{tokenLabel(p.token)}</td>
                      <td className="py-4 pr-4 font-mono text-mute">
                        {Number(p.stopLossPrice) > 0 ? usdFrom1e8(p.stopLossPrice) : "—"}
                      </td>
                      <td className="py-4 pr-4 font-mono text-mute">
                        {Number(p.takeProfitPrice) > 0 ? usdFrom1e8(p.takeProfitPrice) : "—"}
                      </td>
                      <td className="py-4 font-mono text-xs text-mute">{shortAddr(p.owner)}</td>
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

          <section className="mt-16">
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
                        No fills indexed yet — set an active policy and run a trigger.
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
                      <td className="py-4 pr-4 font-mono text-mute">{usdFrom1e8(r.pythPrice)}</td>
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
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
