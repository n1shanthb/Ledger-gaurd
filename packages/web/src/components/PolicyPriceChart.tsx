"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type LineData,
  ColorType,
  LineStyle,
} from "lightweight-charts";

type Props = {
  asset: "eth" | "btc";
  stopLossUsd: string;
  takeProfitUsd: string;
  policyType: 0 | 1 | 2 | 3;
};

function parseLevel(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function PolicyPriceChart({
  asset,
  stopLossUsd,
  takeProfitUsd,
  policyType,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const linesRef = useRef<{
    spot?: IPriceLine;
    stop?: IPriceLine;
    take?: IPriceLine;
  }>({});

  const [live, setLive] = useState<number | null>(null);
  const [histSource, setHistSource] = useState<string>("…");
  const [err, setErr] = useState<string | null>(null);

  const stop = parseLevel(stopLossUsd);
  const take = parseLevel(takeProfitUsd);
  const buy = policyType === 3;
  const stopLabel = buy ? "Buy ≤" : "Stop";
  const takeLabel = buy ? "Buy ≥" : "Take";

  // Create chart once
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8a8780",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#0b0d10" } },
      width: el.clientWidth,
      height: 280,
    });

    const series = chart.addAreaSeries({
      lineColor: "#b8f000",
      topColor: "rgba(184, 240, 0, 0.28)",
      bottomColor: "rgba(184, 240, 0, 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => {
      if (wrapRef.current) {
        chart.applyOptions({ width: wrapRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      linesRef.current = {};
    };
  }, []);

  // Load history when asset changes
  useEffect(() => {
    let cancelled = false;
    const series = seriesRef.current;
    if (!series) return;

    (async () => {
      setErr(null);
      try {
        const res = await fetch(`/api/pyth/history?asset=${asset}&hours=24`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`history ${res.status}`);
        const json = (await res.json()) as {
          source?: string;
          candles?: { time: number; value: number }[];
        };
        if (cancelled) return;
        setHistSource(json.source ?? "unknown");
        const data: LineData[] = (json.candles ?? []).map((c) => ({
          time: c.time as LineData["time"],
          value: c.value,
        }));
        series.setData(data);
        chartRef.current?.timeScale().fitContent();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setHistSource("none");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [asset]);

  // Live Pyth poll
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/pyth?asset=${asset}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { usd?: number };
        if (cancelled || typeof json.usd !== "number") return;
        setLive(json.usd);
        const series = seriesRef.current;
        if (series) {
          const t = Math.floor(Date.now() / 1000);
          series.update({ time: t as LineData["time"], value: json.usd });
        }
      } catch {
        /* ignore poll errors */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 12_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [asset]);

  // Sync price lines from form + live
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const clear = (key: "spot" | "stop" | "take") => {
      const line = linesRef.current[key];
      if (line) {
        series.removePriceLine(line);
        linesRef.current[key] = undefined;
      }
    };

    clear("spot");
    clear("stop");
    clear("take");

    if (live != null) {
      linesRef.current.spot = series.createPriceLine({
        price: live,
        color: "#b8f000",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "Pyth",
      });
    }
    if (stop != null) {
      linesRef.current.stop = series.createPriceLine({
        price: stop,
        color: "#ff5c4d",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: stopLabel,
      });
    }
    if (take != null) {
      linesRef.current.take = series.createPriceLine({
        price: take,
        color: "#ece8e1",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: takeLabel,
      });
    }
  }, [live, stop, take, stopLabel, takeLabel]);

  const nearest =
    live != null
      ? [
          stop != null ? { label: stopLabel, d: Math.abs(live - stop), level: stop } : null,
          take != null ? { label: takeLabel, d: Math.abs(live - take), level: take } : null,
        ]
          .filter(Boolean)
          .sort((a, b) => (a!.d - b!.d) as number)[0]
      : null;

  return (
    <div className="mt-10">
      <h3 className="font-display text-xl text-paper">Price vs policy</h3>
      <p className="mt-1 text-sm text-mute">
        Live marker = on-chain Pyth. History may be Benchmarks or Coinbase display — not
        Graph.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 font-mono text-xs text-mute">
        <span className="rounded-full border border-mist px-3 py-1.5 text-paper">
          {asset.toUpperCase()}{" "}
          {live != null ? (
            <span className="text-signal">${live.toFixed(2)}</span>
          ) : (
            "…"
          )}
        </span>
        {stop != null && (
          <span className="rounded-full border border-kill/40 px-3 py-1.5 text-kill">
            {stopLabel} ${stop.toFixed(2)}
          </span>
        )}
        {take != null && (
          <span className="rounded-full border border-mist px-3 py-1.5 text-paper">
            {takeLabel} ${take.toFixed(2)}
          </span>
        )}
        {nearest && live != null && (
          <span className="rounded-full border border-mist px-3 py-1.5">
            Δ {nearest.label} ${nearest.d.toFixed(2)}
          </span>
        )}
        <span className="rounded-full border border-mist px-3 py-1.5">
          hist {histSource}
        </span>
      </div>

      {err && <p className="mt-3 text-sm text-kill">{err}</p>}

      <div
        ref={wrapRef}
        className="mt-4 w-full overflow-hidden border-t border-line pt-2"
      />
    </div>
  );
}
