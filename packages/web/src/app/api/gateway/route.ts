import { NextResponse } from "next/server";
import {
  compareDexPools,
  compareLendingMarkets,
  evaluateSwapGate,
  fetchAgent0Registry,
} from "@/lib/lgaGraphData";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type CacheEntry = { at: number; body: unknown };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const TTL_MS = Number(process.env.GRAPH_COMPOSE_CACHE_MS ?? 300_000);

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

async function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const warm = cached(key);
  if (warm) return warm as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = run()
    .then((body) => {
      put(key, body);
      return body;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export async function GET(req: Request) {
  try {
    if (
      process.env.GRAPH_COMPOSE === "0" ||
      process.env.NEXT_PUBLIC_GRAPH_COMPOSE === "0"
    ) {
      return NextResponse.json(
        {
          error:
            "Compose Gateway paused (GRAPH_COMPOSE=0) — Receipt Graph still live for Activity/Agent.",
        },
        { status: 503 },
      );
    }
    ensureKey();
    const url = new URL(req.url);
    const first = Number(url.searchParams.get("first") ?? "8") || 8;
    const resource = url.searchParams.get("resource") ?? "all";
    const crossChain = url.searchParams.get("crossChain") === "1";
    const cacheKey = `${resource}:${first}:${crossChain ? 1 : 0}`;

    if (resource === "lending") {
      const data = await once(cacheKey, () =>
        compareLendingMarkets({ first, baseOnly: false, snappy: true }),
      );
      return NextResponse.json(data, {
        headers: { "x-lga-cache": cached(cacheKey) ? "hit" : "miss" },
      });
    }
    if (resource === "dex") {
      const data = await once(cacheKey, () =>
        compareDexPools({
          first,
          baseOnly: !crossChain,
          snappy: true,
        }),
      );
      return NextResponse.json(data);
    }
    if (resource === "agent0") {
      const data = await once(cacheKey, () => fetchAgent0Registry({ first }));
      return NextResponse.json(data);
    }
    if (resource === "decisions") {
      const body = await once(cacheKey, async () => {
        const gate = await evaluateSwapGate({
          crossChainDex: crossChain,
          assetSymbol: "USDC",
          snappy: true,
        });
        return {
          lending: gate.lending,
          dex: gate.dex,
          gate,
          note: "Messari Base Aave offline · ETH/ARB Aave + Base Compound/Seamless",
        };
      });
      return NextResponse.json(body, {
        headers: { "x-lga-cache": "ok" },
      });
    }

    const body = await once(cacheKey, async () => {
      const [lending, dex, agent0] = await Promise.all([
        compareLendingMarkets({ first, baseOnly: false, snappy: true }),
        compareDexPools({ first, baseOnly: !crossChain, snappy: true }),
        fetchAgent0Registry({ first: Math.min(first, 10) }),
      ]);
      return { lending, dex, agent0 };
    });
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
