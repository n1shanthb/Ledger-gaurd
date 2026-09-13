"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { PolicyPriceChart } from "@/components/PolicyPriceChart";
import { useProtectionOptional } from "@/components/ProtectionProvider";
import { EmptyState } from "@/components/ui/Panel";
import { BASE_TOKENS, tokenDecimals } from "@/lib/abi";
import {
  BASESCAN_GPM,
  tokenLabel,
  usdFrom1e8,
  usdNumberFrom1e8,
} from "@/lib/constants";
import { fetchPolicies, type PolicyRow } from "@/lib/subgraph";

type Filter = "all" | "active" | "inactive";
type Scope = "mine" | "global";

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
  const protection = useProtectionOptional();
  const owner = protection?.ownerFilter ?? null;
  const [scope, setScope] = useState<Scope>("mine");
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!owner) setScope("global");
    else setScope("mine");
  }, [owner]);

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
      const raw = e instanceof Error ? e.message : String(e);
      setErr(
        /429|rate limit|Studio/i.test(raw)
          ? `${raw} — hard-refresh (Ctrl+Shift+R). UI must use /api/receipt-graph (Gateway), not Studio.`
          : raw,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scoped = useMemo(() => {
    if (scope === "mine" && owner) {
      return rows.filter((p) => p.owner.toLowerCase() === owner.toLowerCase());
    }
    return rows;
  }, [rows, scope, owner]);

  const filtered = useMemo(() => {
    if (filter === "active") return scoped.filter((p) => p.active);
    if (filter === "inactive") return scoped.filter((p) => !p.active);
    return scoped;
  }, [scoped, filter]);

  const selected = useMemo(
    () => scoped.find((p) => p.id === selectedId) ?? filtered[0] ?? null,
    [scoped, selectedId, filtered],
  );

  const typeN = selected ? policyTypeNum(selected.policyType) : 0;
  const stopN = selected ? usdNumberFrom1e8(selected.stopLossPrice) : null;
  const takeN = selected ? usdNumberFrom1e8(selected.takeProfitPrice) : null;
  const chartStop = typeN === 1 ? "" : stopN != null ? stopN.toFixed(2) : "";
  const chartTake = takeN != null ? takeN.toFixed(2) : "";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-full border border-mist px-3 py-1.5 font-mono text-xs text-mute hover:border-paper hover:text-paper disabled:opacity-40"
          >
            {loading ? "…" : "Refresh"}
          </button>
          <button
            type="button"
            disabled={!owner}
            onClick={() => setScope("mine")}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs disabled:opacity-40 ${
              scope === "mine"
                ? "border-accent text-accent"
                : "border-mist text-mute"
            }`}
          >
            My wallet
          </button>
          <button
            type="button"
            onClick={() => setScope("global")}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs ${
              scope === "global"
                ? "border-warn text-warn"
                : "border-mist text-mute"
            }`}
          >
            Judge / global index
          </button>
          {(
            [
              ["active", "Active"],
              ["inactive", "Off"],
              ["all", "All"],
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

        {scope === "global" && (
          <p className="mt-3 text-xs text-warn">
            Global index shows all indexed owners — for judges/explorers, not your default.
          </p>
        )}

        {loading && rows.length === 0 && (
          <p className="mt-6 font-mono text-xs text-mute">Loading protections…</p>
        )}
        {err && <p className="mt-6 text-sm text-kill">{err}</p>}
        {!loading && !err && filtered.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title={
                scope === "mine"
                  ? "No protections for this wallet"
                  : "No policies in this filter"
              }
              body={
                scope === "mine"
                  ? "Connect on Protect and clear-sign a policy. Indexing may lag a minute after Base confirms."
                  : "Try Active or All, or refresh the Receipt Graph query."
              }
              action={
                <Link
                  href="/protect/journey"
                  className="inline-flex min-h-11 items-center rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:bg-signal"
                >
                  Create protection
                </Link>
              }
            />
          </div>
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
                    on ? "bg-accent/5" : "hover:bg-panel"
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
                      {p.active ? "active" : "filled / off"}
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
                      <span>trigger {usdFrom1e8(p.stopLossPrice)}</span>
                    )}
                    {Number(p.takeProfitPrice) > 0 && (
                      <span>target {usdFrom1e8(p.takeProfitPrice)}</span>
                    )}
                    <span>
                      cover{" "}
                      {formatMax(p.token, p.maxAmount, policyTypeNum(p.policyType))}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        {!selected ? (
          <p className="text-sm text-mute">Select a protection.</p>
        ) : (
          <div className="border-t border-line pt-6 lg:sticky lg:top-28 lg:self-start">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
              Protection detail
            </p>
            <h2 className="mt-2 font-display text-2xl text-paper">
              {policyTypeLabel(selected.policyType)}
            </h2>
            <p className="mt-1 text-sm text-mute">{tokenLabel(selected.token)}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/protect/journey"
                className="rounded-full bg-paper px-3 py-2 text-xs font-semibold text-ink transition hover:bg-signal"
              >
                Adjust on Protect
              </Link>
              <Link
                href="/protect/activity"
                className="rounded-full border border-mist px-3 py-2 text-xs text-mute hover:text-paper"
              >
                View activity
              </Link>
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-mute">Status</dt>
                <dd className={selected.active ? "text-signal" : "text-mute"}>
                  {selected.active
                    ? "Active"
                    : "Inactive (filled or revoked)"}
                </dd>
              </div>
              <div>
                <dt className="text-mute">Covered amount</dt>
                <dd className="font-mono text-paper">
                  {formatMax(selected.token, selected.maxAmount, typeN)}
                </dd>
              </div>
              {Number(selected.stopLossPrice) > 0 && (
                <div>
                  <dt className="text-mute">
                    {typeN === 3 ? "Buy ≤" : "Stop floor"}
                  </dt>
                  <dd className="font-mono text-warn">
                    {usdFrom1e8(selected.stopLossPrice)}
                  </dd>
                </div>
              )}
              {Number(selected.takeProfitPrice) > 0 && (
                <div>
                  <dt className="text-mute">
                    {typeN === 3 ? "Buy ≥" : "Take target"}
                  </dt>
                  <dd className="font-mono text-paper">
                    {usdFrom1e8(selected.takeProfitPrice)}
                  </dd>
                </div>
              )}
            </dl>

            <details className="mt-4 text-xs text-mute">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-2 break-all font-mono">
                Owner {short(selected.owner)} · id {selected.id}
              </p>
              <a
                href={BASESCAN_GPM}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-signal hover:underline"
              >
                GPM on Basescan →
              </a>
            </details>

            <div className="mt-4 border-t border-line pt-2">
              <PolicyPriceChart
                asset={chartAsset(selected.token)}
                stopLossUsd={chartStop}
                takeProfitUsd={chartTake}
                policyType={typeN}
              />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
