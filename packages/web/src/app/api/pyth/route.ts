import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";

const ETH_USD =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as const;
const BTC_USD =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" as const;
const USDC_USD =
  "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a" as const;

const PYTH = "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a" as const;

const FEEDS: Record<string, `0x${string}`> = {
  eth: ETH_USD,
  weth: ETH_USD,
  btc: BTC_USD,
  cbbtc: BTC_USD,
  usdc: USDC_USD,
};

const pythAbi = parseAbi([
  "function getPriceUnsafe(bytes32 id) view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
  "function getPriceNoOlderThan(bytes32 id, uint256 age) view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
]);

function rpc() {
  return process.env.BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
}

/** Round to cents first so spot / stop / take always agree: stop = spot−1, take = spot+1. */
function bandFromUsd(raw: number) {
  const cents = Math.round(raw * 100);
  const usd = cents / 100;
  return {
    usd,
    stopLossUsd: (cents - 100) / 100,
    takeProfitUsd: (cents + 100) / 100,
    usd1e8: Math.round(raw * 1e8),
  };
}

async function onChainPythUsd(feedId: `0x${string}`): Promise<number | null> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(rpc(), { timeout: 15_000 }),
    });
    try {
      const p = await client.readContract({
        address: PYTH,
        abi: pythAbi,
        functionName: "getPriceNoOlderThan",
        args: [feedId, 3600n],
      });
      return Number(p[0]) * 10 ** Number(p[2]);
    } catch {
      const p = await client.readContract({
        address: PYTH,
        abi: pythAbi,
        functionName: "getPriceUnsafe",
        args: [feedId],
      });
      return Number(p[0]) * 10 ** Number(p[2]);
    }
  } catch {
    return null;
  }
}

async function hermesUsd(feedId: string): Promise<number | null> {
  const hermes =
    process.env.PYTH_HERMES_URL ??
    process.env.NEXT_PUBLIC_PYTH_HERMES_URL ??
    "https://hermes.pyth.network";
  const id = feedId.replace(/^0x/, "");
  const headers: HeadersInit = {};
  const key = process.env.PYTH_API_KEY ?? process.env.NEXT_PUBLIC_PYTH_API_KEY;
  if (key) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(`${hermes}/v2/updates/price/latest?ids[]=${id}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      parsed?: { price?: { price?: string; expo?: number } }[];
    };
    const p = json.parsed?.[0]?.price;
    if (!p?.price) return null;
    return Number(p.price) * 10 ** (p.expo ?? -8);
  } catch {
    return null;
  }
}

async function coinbaseUsd(sym: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${sym}/spot`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { amount?: string } };
    const n = Number(json.data?.amount);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function jsonBand(
  raw: number,
  source: string,
  feedId: string,
  warning?: string,
) {
  const band = bandFromUsd(raw);
  return NextResponse.json({
    ...band,
    source,
    feedId,
    ...(warning ? { warning } : {}),
  });
}

/** GET /api/pyth?asset=eth — on-chain Pyth (same as fills) → Hermes → Coinbase */
export async function GET(req: Request) {
  const asset = new URL(req.url).searchParams.get("asset")?.toLowerCase() ?? "eth";
  const feed = FEEDS[asset] ?? ETH_USD;

  const onChain = await onChainPythUsd(feed);
  if (onChain != null && onChain > 0) {
    return jsonBand(onChain, "pyth_onchain", feed);
  }

  const hermes = await hermesUsd(feed);
  if (hermes != null && hermes > 0) {
    return jsonBand(hermes, "pyth_hermes", feed);
  }

  const sym = asset.includes("btc") ? "BTC-USD" : asset === "usdc" ? "USDT-USD" : "ETH-USD";
  const cb = await coinbaseUsd(sym);
  if (cb != null && cb > 0) {
    return jsonBand(
      cb,
      "coinbase_fallback",
      feed,
      "On-chain Pyth + Hermes unavailable — band uses Coinbase. Fills still use Pyth VAAs.",
    );
  }

  return NextResponse.json({ error: "no price" }, { status: 502 });
}
