"use client";

import { useEffect, useState } from "react";

export type PriceSide = "loss" | "profit" | "buy-low" | "buy-high";

type Props = {
  label: string;
  hint?: string;
  side: PriceSide;
  value: string;
  onChange: (v: string) => void;
  asset: "eth" | "btc";
};

const SIDE_COPY: Record<PriceSide, { badge: string; tone: string }> = {
  loss: { badge: "Sell · loss", tone: "text-kill border-kill/40" },
  profit: { badge: "Sell · profit", tone: "text-signal border-signal/40" },
  "buy-low": { badge: "Buy · dip", tone: "text-signal border-signal/40" },
  "buy-high": { badge: "Buy · breakout", tone: "text-paper border-mist" },
};

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n >= 1000) return n.toFixed(2);
  return n.toFixed(2);
}

export function PolicyLevelField({
  label,
  hint,
  side,
  value,
  onChange,
  asset,
}: Props) {
  const [spot, setSpot] = useState<number | null>(null);
  const [src, setSrc] = useState<string>("…");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/pyth?asset=${asset}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`pyth ${res.status}`);
        const j = (await res.json()) as { usd: number; source?: string };
        if (dead) return;
        setSpot(j.usd);
        setSrc(j.source ?? "pyth");
        setErr(null);
      } catch (e) {
        if (!dead) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 10_000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [asset]);

  const meta = SIDE_COPY[side];
  const lossLike = side === "loss" || side === "buy-low";
  const deltas = lossLike ? ([-1, -10, -100] as const) : ([1, 10, 100] as const);

  const apply = (delta: number) => {
    if (spot == null) return;
    onChange(fmt(spot + delta));
  };

  return (
    <div className="rounded-lg border border-line bg-ink/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${meta.tone}`}>
          {meta.badge}
        </span>
        <span className="text-xs font-medium text-mute">{label}</span>
        <span className="ml-auto font-mono text-xs text-paper">
          {spot != null ? `$${spot.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "…"}
          <span className="ml-1 text-mute">{src}</span>
        </span>
      </div>
      {hint && <p className="mt-1 text-[11px] text-mute">{hint}</p>}
      {err && <p className="mt-1 text-[11px] text-kill">{err}</p>}

      <input
        className="mt-2 w-full rounded-lg border border-mist bg-panel px-3 py-2 font-mono text-sm text-paper outline-none focus:border-signal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={spot == null}
          onClick={() => spot != null && onChange(fmt(spot))}
          className="rounded-full border border-mist px-2.5 py-1 font-mono text-[11px] text-mute hover:border-paper hover:text-paper disabled:opacity-40"
        >
          Current
        </button>
        {deltas.map((d) => (
          <button
            key={d}
            type="button"
            disabled={spot == null}
            onClick={() => apply(d)}
            className="rounded-full border border-mist px-2.5 py-1 font-mono text-[11px] text-mute hover:border-signal hover:text-signal disabled:opacity-40"
          >
            {d > 0 ? `+${d}` : `${d}`}
          </button>
        ))}
      </div>
    </div>
  );
}
