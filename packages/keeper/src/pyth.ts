import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";

const LEGACY_HERMES = "https://hermes.pyth.network";
const UPGRADED_HERMES = "https://pyth.dourolabs.app/hermes";

const PYTH = "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a" as const;

export const ETH_USD =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
export const BTC_USD =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
export const USDC_USD =
  "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

const CBBTC = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

const pythAbi = parseAbi([
  "function getPriceUnsafe(bytes32 id) view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
  "function getPriceNoOlderThan(bytes32 id, uint256 age) view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
]);

export function feedForToken(token: string): string {
  const t = token.toLowerCase();
  if (t === USDC) return USDC_USD;
  if (t === CBBTC) return BTC_USD;
  return ETH_USD;
}

function hermesBase(): string {
  return (
    process.env.PYTH_PRICE_SERVICE_URL ??
    (process.env.PYTH_API_KEY ? UPGRADED_HERMES : LEGACY_HERMES)
  );
}

function hermesHeaders(): HeadersInit {
  const key = process.env.PYTH_API_KEY;
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

function toUsd1e8(price: bigint, expo: number): bigint {
  const e = expo + 8;
  if (e >= 0) return price * 10n ** BigInt(e);
  return price / 10n ** BigInt(-e);
}

/** On-chain Pyth (same contract fills use after VAA verify) — no API key. */
export async function fetchSpotOnChain1e8(feedId: string): Promise<bigint> {
  const rpc = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
  const client = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 15_000 }),
  });
  const id = feedId as `0x${string}`;
  try {
    const p = await client.readContract({
      address: PYTH,
      abi: pythAbi,
      functionName: "getPriceNoOlderThan",
      args: [id, 3600n],
    });
    return toUsd1e8(BigInt(p[0]), Number(p[2]));
  } catch {
    const p = await client.readContract({
      address: PYTH,
      abi: pythAbi,
      functionName: "getPriceUnsafe",
      args: [id],
    });
    return toUsd1e8(BigInt(p[0]), Number(p[2]));
  }
}

async function fetchSpotHermes1e8(feedId: string): Promise<bigint> {
  const id = feedId.replace(/^0x/, "");
  const res = await fetch(`${hermesBase()}/v2/updates/price/latest?ids[]=${id}`, {
    headers: hermesHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Hermes auth required — set PYTH_API_KEY (Pyth Terminal). Spot eval can use on-chain; VAAs still need the key.",
    );
  }
  if (!res.ok) throw new Error(`hermes ${res.status}`);
  const json = (await res.json()) as {
    parsed?: { price?: { price?: string; expo?: number } }[];
  };
  const p = json.parsed?.[0]?.price;
  if (!p?.price) throw new Error("hermes empty");
  return toUsd1e8(BigInt(p.price), p.expo ?? -8);
}

/** Prefer on-chain spot; Hermes only if chain read fails. */
export async function fetchSpotUsd1e8(feedId: string): Promise<bigint> {
  try {
    return await fetchSpotOnChain1e8(feedId);
  } catch (e) {
    console.warn("[lga] on-chain pyth spot failed, trying Hermes", e);
    return fetchSpotHermes1e8(feedId);
  }
}

/** VAAs for executePolicy — Hermes requires PYTH_API_KEY after Aug 2026 Core upgrade. */
export async function fetchVaas(feedId: string): Promise<`0x${string}`[]> {
  if (!process.env.PYTH_API_KEY) {
    throw new Error(
      "PYTH_API_KEY missing — required for Hermes VAAs after Pyth Core upgrade. Get a key at https://pyth.network terminal, add to packages/keeper/.env",
    );
  }
  const id = feedId.replace(/^0x/, "");
  const bases = [
    hermesBase(),
    UPGRADED_HERMES,
    LEGACY_HERMES,
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastErr = "no vaa";
  for (const base of bases) {
    try {
      const res = await fetch(
        `${base}/v2/updates/price/latest?ids[]=${id}&encoding=hex`,
        { headers: hermesHeaders(), signal: AbortSignal.timeout(20_000) },
      );
      if (res.status === 401 || res.status === 403) {
        lastErr = `hermes ${res.status} at ${base} — check PYTH_API_KEY`;
        continue;
      }
      if (!res.ok) {
        lastErr = `hermes ${res.status} at ${base}`;
        continue;
      }
      const json = (await res.json()) as { binary?: { data?: string[] } };
      const data = json.binary?.data ?? [];
      if (!data.length) {
        lastErr = `empty vaa at ${base}`;
        continue;
      }
      return data.map((d) => (d.startsWith("0x") ? d : `0x${d}`)) as `0x${string}`[];
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}

export function shouldTrigger(
  spot: bigint,
  stopLoss: bigint,
  takeProfit: bigint,
): "STOP_LOSS" | "TAKE_PROFIT" | null {
  if (stopLoss > 0n && spot <= stopLoss) return "STOP_LOSS";
  if (takeProfit > 0n && spot >= takeProfit) return "TAKE_PROFIT";
  return null;
}
