"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { PolicyPriceChart } from "@/components/PolicyPriceChart";
import { BASE_TOKENS, tokenDecimals } from "@/lib/abi";
import {
  BASESCAN_GPM,
  tokenLabel,
  usdFrom1e8,
  usdNumberFrom1e8,
} from "@/lib/constants";
import { fetchPolicies, type PolicyRow } from "@/lib/subgraph";

type Filter = "all" | "active" | "inactive";

function policyTypeNum(t: string | number): 0 | 1 | 2 | 3 {
  const s = String(t);
  if (s === "1" || s === "TAKE_PROFIT") return 1;
  if (s === "2" || s === "LP_STOP_LOSS") return 2;
  if (s === "3" || s === "BUY_DIP") return 3;
  return 0;
}

function policyTypeLabel(t: string | number): string {
  const n = policyTypeNum(t);
  if (n === 1) return "Take-profit";
  if (n === 2) return "LP stop-loss";
  if (n === 3) return "Buy-dip";
  return "Stop-loss";
}

function chartAsset(token: string): "eth" | "btc" {
  return token.toLowerCase() === BASE_TOKENS.CBBTC.toLowerCase() ? "btc" : "eth";
}

function short(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatMax(token: string, raw: string, type: 0 | 1 | 2 | 3): string {
  try {
    const dec = type === 3 ? 6 : tokenDecimals(token);
    const n = Number(formatUnits(BigInt(raw), dec));
    if (!Number.isFinite(n)) return raw;
    const unit = type === 3 ? "USDC" : tokenLabel(token).split(" ")[0] ?? "tok";
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${unit}`;
  } catch {
    return raw;
  }
}

export function PoliciesExplorer() {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchPolicies(50);
      setRows(list);
      setSelectedId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "active") return rows.filter((p) => p.active);
    if (filter === "inactive") return rows.filter((p) => !p.active);
    return rows;
  }, [rows, filter]);

  const selected = useMemo(
    () => rows.find((p) => p.id === selectedId) ?? filtered[0] ?? null,
    [rows, selectedId, filtered],
  );

  const typeN = selected ? policyTypeNum(selected.policyType) : 0;
  const stopN = selected ? usdNumberFrom1e8(selected.stopLossPrice) : null;
  const takeN = selected ? usdNumberFrom1e8(selected.takeProfitPrice) : null;

  // TP-only: take + spot. SL: stop (+ take if set). LP / buy-dip: band lines.
  const chartStop =
    typeN === 1 ? "" : stopN != null ? stopN.toFixed(2) : "";
  const chartTake = takeN != null ? takeN.toFixed(2) : "";

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["inactive", "Inactive"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs ${
                filter === k
                  ? "border-signal text-signal"
                  : "border-mist text-mute hover:border-paper hover:text-paper"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto rounded-full border border-mist px-3 py-1.5 font-mono text-xs text-mute hover:text-paper"
          >
            Refresh
          </button>
        </div>

        {loading && rows.length === 0 && (
          <p className="mt-6 font-mono text-xs text-mute">Loading policies…</p>
        )}
        {err && <p className="mt-6 text-sm text-kill">{err}</p>}
        {!loading && !err && filtered.length === 0 && (
          <p className="mt-6 text-sm text-mute">No policies in this filter.</p>
        )}

        <ul className="mt-4 divide-y divide-line border-t border-line">
          {filtered.map((p) => {
            const on = selected?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full flex-col gap-1 px-1 py-4 text-left transition ${
                    on ? "bg-signal/5" : "hover:bg-panel"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        p.active
                          ? "bg-signal/15 text-signal"
                          : "bg-mist text-mute"
                      }`}
                    >
                      {p.active ? "active" : "inactive"}
                    </span>
                    <span className="text-sm text-paper">
                      {policyTypeLabel(p.policyType)}
                    </span>
                    <span className="font-mono text-xs text-mute">
                      {tokenLabel(p.token)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 font-mono text-xs text-mute">
                    {Number(p.stopLossPrice) > 0 && (
                      <span>stop {usdFrom1e8(p.stopLossPrice)}</span>
                    )}
                    {Number(p.takeProfitPrice) > 0 && (
                      <span>take {usdFrom1e8(p.takeProfitPrice)}</span>
                    )}
                    <span className="text-mute/80">{short(p.owner)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        {!selected ? (
          <p className="text-sm text-mute">Select a policy to inspect levels.</p>
        ) : (
          <div className="border border-line bg-panel p-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
              Policy detail
            </p>
            <h2 className="mt-2 font-display text-2xl text-paper">
              {policyTypeLabel(selected.policyType)}
            </h2>
            <p className="mt-1 text-sm text-mute">{tokenLabel(selected.token)}</p>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-mute">Status</dt>
                <dd className={selected.active ? "text-signal" : "text-mute"}>
                  {selected.active ? "Active" : "Inactive"}
                </dd>
              </div>
              <div>
                <dt className="text-mute">Owner</dt>
                <dd className="font-mono text-xs text-paper">
                  <a
                    href={`https://basescan.org/address/${selected.owner}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-signal"
                  >
                    {short(selected.owner)}
                  </a>
                </dd>
              </div>
              {Number(selected.stopLossPrice) > 0 && (
                <div>
                  <dt className="text-mute">
                    {typeN === 3 ? "Buy ≤ (dip)" : "Stop-loss floor"}
                  </dt>
                  <dd className="font-mono text-kill">
                    {usdFrom1e8(selected.stopLossPrice)}
                  </dd>
                </div>
              )}
              {Number(selected.takeProfitPrice) > 0 && (
                <div>
                  <dt className="text-mute">
                    {typeN === 3 ? "Buy ≥ (breakout)" : "Take-profit target"}
                  </dt>
                  <dd className="font-mono text-paper">
                    {usdFrom1e8(selected.takeProfitPrice)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-mute">
                  {typeN === 3 ? "USDC spend" : "Max amount"}
                </dt>
                <dd className="font-mono text-paper">
                  {formatMax(selected.token, selected.maxAmount, typeN)}
                </dd>
              </div>
              <div>
                <dt className="text-mute">Created</dt>
                <dd className="font-mono text-xs text-mute">
                  {new Date(Number(selected.createdAt) * 1000).toLocaleString()}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-mute">Policy id</dt>
                <dd className="break-all font-mono text-[10px] text-mute">
                  {selected.id}
                </dd>
              </div>
            </dl>

            <a
              href={BASESCAN_GPM}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block font-mono text-xs text-signal hover:underline"
            >
              GPM on Basescan →
            </a>

            <div className="mt-2 border-t border-line pt-2">
              <PolicyPriceChart
                asset={chartAsset(selected.token)}
                stopLossUsd={chartStop}
                takeProfitUsd={chartTake}
                policyType={typeN}
              />
            </div>

            <p className="mt-3 font-mono text-[10px] text-mute">
              {typeN === 1 && "Chart: Pyth spot vs take-profit target."}
              {typeN === 0 &&
                "Chart: Pyth spot vs stop-loss floor" +
                  (takeN != null ? " (+ take if set)." : ".")}
              {typeN === 2 &&
                "Chart: LP band — bottom sell (stop) + top take + live Pyth."}
              {typeN === 3 &&
                "Chart: buy-dip — Buy ≤ / Buy ≥ vs live Pyth."}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
