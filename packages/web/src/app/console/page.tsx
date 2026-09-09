import Link from "next/link";
import { ConsoleNav } from "@/components/ConsoleNav";
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

const workspaces = [
  {
    href: "/console/ledger",
    title: "Ledger",
    blurb: "Connect device, clear-sign policies, kill switch.",
  },
  {
    href: "/console/agent",
    title: "Agent",
    blurb: "Keeper chat, Messari gate tools, x402 payments.",
  },
  {
    href: "/console/compose",
    title: "Compose",
    blurb: "One Messari query → borrow + WETH depth decisions.",
  },
  {
    href: "/policies",
    title: "Policies",
    blurb: "Board view with Pyth levels on the chart.",
  },
  {
    href: "/console/receipts",
    title: "Receipts",
    blurb: "Execution receipts and kill-switch events.",
  },
];

export default async function ConsolePage() {
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

  const active = policies.filter((p) => p.active).length;
  const compliant = receipts.filter((r) => r.compliant).length;
  const recent = receipts.slice(0, 5);
  const recentPolicies = policies.slice(0, 4);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-ink pt-24">
        <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">
            Console
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper md:text-5xl">
            Ops dashboard
          </h1>
          <p className="mt-4 max-w-2xl text-mute">
            Receipt Graph pulse on Base. Open a workspace for Ledger, agent,
            compose, or full receipt history — not one endless page.
          </p>

          <ConsoleNav />

          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs text-mute">
            <span className="rounded-full border border-mist px-3 py-1.5">
              GPM {shortAddr(GPM_V2)}
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

          {error && (
            <p className="mt-8 rounded-lg border border-kill/40 bg-kill/10 px-4 py-3 text-sm text-kill">
              Subgraph query failed: {error}
            </p>
          )}

          <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Active policies", value: String(active) },
              { label: "Policies indexed", value: String(policies.length) },
              {
                label: "Receipts",
                value: `${receipts.length}${receipts.length ? ` · ${compliant} ok` : ""}`,
              },
              { label: "Kill events", value: String(kills.length) },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-line bg-panel/60 px-4 py-4"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-mute">
                  {s.label}
                </p>
                <p className="mt-2 font-display text-2xl text-paper">{s.value}</p>
              </div>
            ))}
          </section>

          <section className="mt-12">
            <h2 className="font-display text-xl text-paper">Workspaces</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((w) => (
                <Link
                  key={w.href}
                  href={w.href}
                  className="group rounded-xl border border-line bg-panel/40 p-4 transition hover:border-signal/50"
                >
                  <p className="font-display text-lg text-paper group-hover:text-signal">
                    {w.title}
                  </p>
                  <p className="mt-1 text-sm text-mute">{w.blurb}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-14 grid gap-10 lg:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl text-paper">Recent policies</h2>
                <Link
                  href="/policies"
                  className="font-mono text-xs text-signal hover:underline"
                >
                  Board →
                </Link>
              </div>
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {recentPolicies.length === 0 && !error && (
                  <li className="py-6 text-sm text-mute">No policies indexed yet.</li>
                )}
                {recentPolicies.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <span className="text-paper">{policyTypeLabel(p.policyType)}</span>
                    <span className="font-mono text-xs text-mute">
                      {tokenLabel(p.token)} ·{" "}
                      {p.active ? (
                        <span className="text-signal">active</span>
                      ) : (
                        "off"
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl text-paper">Recent fills</h2>
                <Link
                  href="/console/receipts"
                  className="font-mono text-xs text-signal hover:underline"
                >
                  All →
                </Link>
              </div>
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {recent.length === 0 && !error && (
                  <li className="py-6 text-sm text-mute">
                    No fills yet — set a policy and trigger.
                  </li>
                )}
                {recent.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <span
                      className={
                        r.compliant
                          ? "font-mono text-xs text-signal"
                          : "font-mono text-xs text-kill"
                      }
                    >
                      {r.compliant ? "compliant" : "flagged"}
                    </span>
                    <span className="font-mono text-xs text-mute">
                      Pyth {usdFrom1e8(r.pythPrice)} · fill{" "}
                      {usdFrom1e8(r.executionPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
