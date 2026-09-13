"use client";

import { useMemo, useState } from "react";
import type { AssetHolding } from "@/lib/holdings";
import { Button } from "@/components/ui/Button";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtUsd(n: number | null | undefined, opts?: { compact?: boolean }) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (opts?.compact && Math.abs(n) >= 1000) {
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtBal(h: AssetHolding) {
  if (!h.balanceOk) return "—";
  const n = Number(h.balanceFormatted);
  if (!Number.isFinite(n)) return h.balanceFormatted;
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return h.balanceFormatted;
}

const GLYPH: Record<string, { bg: string; fg: string }> = {
  eth: { bg: "bg-[#627eea]/20", fg: "text-[#9db0ff]" },
  weth: { bg: "bg-[#627eea]/15", fg: "text-[#9db0ff]" },
  cbbtc: { bg: "bg-[#f7931a]/15", fg: "text-[#f0b35a]" },
  usdc: { bg: "bg-[#2775ca]/20", fg: "text-[#7eb6ef]" },
  cbeth: { bg: "bg-signal/15", fg: "text-signal" },
};

function TokenGlyph({ id, symbol }: { id: string; symbol: string }) {
  const g = GLYPH[id] ?? { bg: "bg-mist/40", fg: "text-paper" };
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${g.bg} ${g.fg}`}
      aria-hidden
    >
      {symbol.slice(0, 3)}
    </span>
  );
}

export function LedgerWallet({
  address,
  accountLabel,
  holdings,
  loading,
  error,
  onRefresh,
  onSelect,
  selectHint = "Protect →",
}: {
  address: string | null;
  accountLabel?: string;
  holdings: AssetHolding[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onSelect?: (h: AssetHolding) => void;
  selectHint?: string;
}) {
  const [hideZero, setHideZero] = useState(false);
  const [copied, setCopied] = useState(false);

  const totalUsd = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const h of holdings) {
      if (h.valueUsd != null) {
        sum += h.valueUsd;
        any = true;
      }
    }
    return any ? sum : null;
  }, [holdings]);

  const rows = useMemo(() => {
    const sorted = [...holdings].sort((a, b) => {
      const av = a.valueUsd ?? (a.balanceOk && a.balance > 0n ? 0 : -1);
      const bv = b.valueUsd ?? (b.balanceOk && b.balance > 0n ? 0 : -1);
      return bv - av;
    });
    if (!hideZero) return sorted;
    return sorted.filter((h) => h.balanceOk && h.balance > 0n);
  }, [holdings, hideZero]);

  const copyAddr = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="overflow-hidden border border-line bg-panel/80">
      <div className="relative border-b border-line px-5 pb-6 pt-5 sm:px-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 10% 0%, rgba(163,230,53,0.08), transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
              Ledger · Base
              {accountLabel ? ` · ${accountLabel}` : ""}
            </p>
            {address ? (
              <button
                type="button"
                onClick={() => void copyAddr()}
                className="mt-2 font-mono text-sm text-paper hover:text-signal"
                title="Copy address"
              >
                {shortAddr(address)}
                <span className="ml-2 text-[10px] uppercase tracking-wider text-mute">
                  {copied ? "copied" : "copy"}
                </span>
              </button>
            ) : (
              <p className="mt-2 text-sm text-mute">No address yet</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-mist px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-mute">
              Master key on device
            </span>
            {onRefresh && (
              <Button
                variant="ghost"
                className="!min-h-0 !px-3 !py-1.5 text-xs"
                disabled={loading}
                onClick={onRefresh}
              >
                {loading ? "Reading…" : "Refresh"}
              </Button>
            )}
          </div>
        </div>

        <p className="relative mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
          Portfolio
        </p>
        {loading && holdings.length === 0 ? (
          <div className="relative mt-2 h-10 w-48 animate-pulse bg-mist/30" />
        ) : (
          <p className="relative mt-1 font-display text-4xl tracking-tight text-paper sm:text-5xl">
            {fmtUsd(totalUsd)}
          </p>
        )}
        <p className="relative mt-2 text-xs text-mute">
          Balances read on-chain for this Ledger account. Master key never leaves
          Ledger.
        </p>
      </div>

      {error && (
        <p className="border-b border-kill/30 bg-kill/5 px-5 py-3 text-sm text-kill sm:px-7">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
          Assets
        </p>
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute hover:text-paper"
          onClick={() => setHideZero((v) => !v)}
        >
          {hideZero ? "Show zeros" : "Hide zeros"}
        </button>
      </div>

      {loading && holdings.length === 0 ? (
        <ul className="divide-y divide-line" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-4 sm:px-7">
              <span className="h-11 w-11 animate-pulse rounded-full bg-mist/30" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-20 animate-pulse bg-mist/30" />
                <div className="h-3 w-28 animate-pulse bg-mist/20" />
              </div>
              <div className="h-4 w-16 animate-pulse bg-mist/30" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="px-5 py-10 text-sm text-mute sm:px-7">
          No assets to show. Fund this account on Base, then refresh.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((h) => {
            const empty = h.balanceOk && h.balance === 0n;
            const selectable = Boolean(onSelect) && h.id !== "usdc";
            const inner = (
              <>
                <TokenGlyph id={h.id} symbol={h.symbol} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p
                      className={`font-display text-lg tracking-tight ${empty ? "text-mute" : "text-paper"}`}
                    >
                      {h.symbol}
                    </p>
                    {h.id === "usdc" && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-mute">
                        buy-dip
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-mute">{h.name}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-mono text-sm tabular-nums ${empty ? "text-mute" : "text-paper"}`}
                  >
                    {fmtBal(h)}
                  </p>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-mute">
                    {fmtUsd(h.valueUsd)}
                  </p>
                  {selectable && (
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-signal">
                      {selectHint}
                    </p>
                  )}
                  {h.id === "usdc" && (
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mute">
                      Spend only
                    </p>
                  )}
                </div>
              </>
            );

            return (
              <li key={h.id}>
                {selectable ? (
                  <button
                    type="button"
                    onClick={() => onSelect?.(h)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-signal/[0.04] focus-visible:bg-signal/[0.06] sm:px-7"
                  >
                    {inner}
                  </button>
                ) : (
                  <div
                    className={`flex items-center gap-3 px-5 py-4 sm:px-7 ${empty ? "opacity-55" : ""}`}
                  >
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
