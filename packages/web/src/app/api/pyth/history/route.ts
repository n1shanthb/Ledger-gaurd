import { NextResponse } from "next/server";

type Candle = { time: number; value: number };

function pythSymbol(asset: string): string {
  return asset.includes("btc") ? "Crypto.BTC/USD" : "Crypto.ETH/USD";
}

function coinbaseProduct(asset: string): string {
  return asset.includes("btc") ? "BTC-USD" : "ETH-USD";
}

async function pythBenchmarks(
  asset: string,
  from: number,
  to: number,
): Promise<Candle[] | null> {
  const key = process.env.PYTH_API_KEY ?? process.env.NEXT_PUBLIC_PYTH_API_KEY;
  if (!key) return null;

  const symbol = encodeURIComponent(pythSymbol(asset));
  const url = `https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=${symbol}&resolution=15&from=${from}&to=${to}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      s?: string;
      t?: number[];
      c?: number[];
    };
    if (json.s !== "ok" || !json.t?.length || !json.c?.length) return null;
    const out: Candle[] = [];
    for (let i = 0; i < json.t.length; i++) {
      const v = json.c[i];
      if (typeof v === "number" && Number.isFinite(v)) {
        out.push({ time: json.t[i], value: v });
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** Coinbase Exchange candles: [ time, low, high, open, close, volume ] */
async function coinbaseCandles(
  asset: string,
  startIso: string,
  endIso: string,
): Promise<Candle[] | null> {
  const product = coinbaseProduct(asset);
  const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=900&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as number[][];
    if (!Array.isArray(rows) || !rows.length) return null;
    // Coinbase returns newest first — reverse for chart
    const out: Candle[] = rows
      .map((r) => ({ time: r[0], value: r[4] }))
      .filter((c) => Number.isFinite(c.value) && c.time > 0)
      .sort((a, b) => a.time - b.time);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** GET /api/pyth/history?asset=eth&hours=24 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const asset = (sp.get("asset") ?? "eth").toLowerCase();
  const hours = Math.min(168, Math.max(1, Number(sp.get("hours") ?? 24) || 24));
  const to = Math.floor(Date.now() / 1000);
  const from = to - hours * 3600;

  const pyth = await pythBenchmarks(asset, from, to);
  if (pyth?.length) {
    return NextResponse.json({
      source: "pyth_benchmarks",
      asset,
      candles: pyth,
    });
  }

  const cb = await coinbaseCandles(
    asset,
    new Date(from * 1000).toISOString(),
    new Date(to * 1000).toISOString(),
  );
  if (cb?.length) {
    return NextResponse.json({
      source: "coinbase_display",
      asset,
      candles: cb,
    });
  }

  return NextResponse.json({ error: "no history" }, { status: 502 });
}
