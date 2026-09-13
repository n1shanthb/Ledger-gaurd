"use client";

import { useComposeDecisions } from "@/hooks/useGateway";

function usd(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function utilPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function ComposeProof() {
  const composeOn =
    process.env.NEXT_PUBLIC_GRAPH_COMPOSE !== "0";
  const q = useComposeDecisions({ enabled: composeOn });
  const missingKey =
    q.isError && String(q.error?.message ?? "").includes("GRAPH_API_KEY");

  const gate = q.data?.gate;
  const lending = q.data?.lending;
  const dex = q.data?.dex;

  if (!composeOn) {
    return (
      <section className="mt-10 rounded-xl border border-line bg-panel p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
          Live Gateway
        </p>
        <p className="mt-2 text-sm text-mute">
          Compose Messari fan-out paused (
          <code className="text-paper">NEXT_PUBLIC_GRAPH_COMPOSE=0</code>) —
          saves Gateway quota while recording. Receipt Graph still serves
          Activity, Protections, and Agent Clerk.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
        Live Gateway
      </p>
      <p className="mt-1 text-sm text-mute">
        One Messari document → many lending/DEX deployments on Gateway, composed
        with Receipt Graph context — same decide API the keeper Solver uses.
      </p>

      {missingKey && (
        <p className="mt-3 text-sm text-amber-200/90">
          Set <code className="text-paper">GRAPH_API_KEY</code> in{" "}
          <code className="text-paper">packages/web/.env</code>, restart{" "}
          <code className="text-paper">npm run dev</code>.
        </p>
      )}

      {q.isLoading && (
        <p className="mt-3 text-sm text-mute">
          Fan-out Messari lending + DEX (first load can take ~15–30s; then
          cached)…
        </p>
      )}
      {q.isFetching && !q.isLoading && (
        <p className="mt-3 text-sm text-mute">Refreshing…</p>
      )}
      {q.isError && !missingKey && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-300">
            {q.error instanceof Error ? q.error.message : "gateway error"}
          </p>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="rounded-full border border-mist px-3 py-1 text-xs text-signal hover:border-signal"
          >
            Retry
          </button>
        </div>
      )}

      {gate && (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            gate.proceed
              ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-100"
              : "border-amber-700/50 bg-amber-950/30 text-amber-100"
          }`}
        >
          <span className="font-medium">
            {gate.proceed ? "Gate clear — OK to route" : "Gate warn — tighten / delay"}
          </span>
          <ul className="mt-1 list-inside list-disc text-xs opacity-90">
            {gate.reasons.slice(0, 4).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-ink/40 p-3">
          <p className="text-[10px] uppercase tracking-wide text-mute">
            Safest Base USDC borrow
          </p>
          <p className="mt-1 font-display text-base text-paper">
            {lending?.winner
              ? `${lending.winner.protocolSlug} · ${utilPct(lending.winner.utilization)}`
              : lending?.verdict ?? "—"}
          </p>
          {lending?.winner && (
            <p className="mt-1 text-xs text-mute">
              {lending.winner.assetSymbol} · TVL {usd(lending.winner.totalValueLockedUSD)}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-line bg-ink/40 p-3">
          <p className="text-[10px] uppercase tracking-wide text-mute">
            Deepest WETH pool
          </p>
          <p className="mt-1 font-display text-base text-paper">
            {dex?.winner
              ? `${dex.winner.pairLabel} · ${dex.winner.protocolSlug}/${dex.winner.network}`
              : dex?.verdict ?? "—"}
          </p>
          {dex?.winner && (
            <p className="mt-1 text-xs text-mute">
              TVL {usd(dex.winner.totalValueLockedUSD)}
            </p>
          )}
        </div>
      </div>

      {lending && lending.matrix.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <h4 className="text-xs font-medium uppercase tracking-wide text-mute">
            Lending matrix (per protocol)
          </h4>
          <table className="mt-2 w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-mute">
                <th className="py-2 pr-3 font-medium">Protocol</th>
                <th className="py-2 pr-3 font-medium">Net</th>
                <th className="py-2 pr-3 font-medium">Asset</th>
                <th className="py-2 pr-3 font-medium">Util</th>
                <th className="py-2 font-medium">TVL</th>
              </tr>
            </thead>
            <tbody>
              {lending.matrix.map((m) => (
                <tr
                  key={`${m.deploymentId}-${m.marketId}`}
                  className="border-b border-line/60 text-paper"
                >
                  <td className="py-2 pr-3">{m.protocolSlug}</td>
                  <td className="py-2 pr-3">{m.network}</td>
                  <td className="py-2 pr-3">{m.assetSymbol}</td>
                  <td className="py-2 pr-3">{utilPct(m.utilization)}</td>
                  <td className="py-2">{usd(m.totalValueLockedUSD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dex && dex.matrix.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <h4 className="text-xs font-medium uppercase tracking-wide text-mute">
            DEX matrix (WETH · per protocol)
          </h4>
          <table className="mt-2 w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-mute">
                <th className="py-2 pr-3 font-medium">Protocol</th>
                <th className="py-2 pr-3 font-medium">Net</th>
                <th className="py-2 pr-3 font-medium">Pair</th>
                <th className="py-2 font-medium">TVL</th>
              </tr>
            </thead>
            <tbody>
              {dex.matrix.map((p) => (
                <tr
                  key={`${p.deploymentId}-${p.poolId}`}
                  className="border-b border-line/60 text-paper"
                >
                  <td className="py-2 pr-3">{p.protocolSlug}</td>
                  <td className="py-2 pr-3">{p.network}</td>
                  <td className="py-2 pr-3">{p.pairLabel}</td>
                  <td className="py-2">{usd(p.totalValueLockedUSD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-mute">
        lending ok={lending?.deploymentsOk ?? "—"} · dex ok=
        {dex?.deploymentsOk ?? "—"}
        {lending?.provenance[0]
          ? ` · e.g. ${lending.provenance[0].deploymentId.slice(0, 8)}… @${lending.provenance[0].blockNumber}`
          : ""}
        {q.data?.note ? ` · ${q.data.note}` : ""}
      </p>
    </section>
  );
}
