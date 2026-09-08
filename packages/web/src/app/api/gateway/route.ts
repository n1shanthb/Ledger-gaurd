import { NextResponse } from "next/server";
import {
  compareDexPools,
  compareLendingMarkets,
  evaluateSwapGate,
  fetchAgent0Registry,
} from "@/lib/lgaGraphData";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CacheEntry = { at: number; body: unknown };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 45_000;

function ensureKey() {
  const key =
    process.env.GRAPH_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GRAPH_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GRAPH_API_KEY missing in packages/web/.env (Studio → API Keys)",
    );
  }
  process.env.GRAPH_API_KEY = key;
}

function cached(key: string): unknown | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.body;
}

function put(key: string, body: unknown) {
  cache.set(key, { at: Date.now(), body });
}

export async function GET(req: Request) {
  try {
    ensureKey();
    const url = new URL(req.url);
    const first = Number(url.searchParams.get("first") ?? "8") || 8;
    const resource = url.searchParams.get("resource") ?? "all";
    const crossChain = url.searchParams.get("crossChain") === "1";
    const cacheKey = `${resource}:${first}:${crossChain ? 1 : 0}`;

    const warm = cached(cacheKey);
    if (warm) {
      return NextResponse.json(warm, {
        headers: { "x-lga-cache": "hit" },
      });
    }

    if (resource === "lending") {
      const data = await compareLendingMarkets({ first, baseOnly: false });
      put(cacheKey, data);
      return NextResponse.json(data);
    }
    if (resource === "dex") {
      const data = await compareDexPools({
        first,
        baseOnly: !crossChain,
      });
      put(cacheKey, data);
      return NextResponse.json(data);
    }
    if (resource === "agent0") {
      const data = await fetchAgent0Registry({ first });
      put(cacheKey, data);
      return NextResponse.json(data);
    }
    if (resource === "decisions") {
      // Single evaluateSwapGate call (embeds lending + dex) — avoids 2× Gateway load.
      const gate = await evaluateSwapGate({
        crossChainDex: crossChain,
        assetSymbol: "USDC",
      });
      const body = {
        lending: gate.lending,
        dex: gate.dex,
        gate,
        note: "Messari Base Aave offline · ETH/ARB Aave + Base Compound/Seamless",
      };
      put(cacheKey, body);
      return NextResponse.json(body, {
        headers: { "x-lga-cache": "miss" },
      });
    }

    const [lending, dex, agent0] = await Promise.all([
      compareLendingMarkets({ first, baseOnly: false }),
      compareDexPools({ first, baseOnly: !crossChain }),
      fetchAgent0Registry({ first: Math.min(first, 10) }),
    ]);
    const body = { lending, dex, agent0 };
    put(cacheKey, body);
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
