import {
  createPublicClient,
  formatEther,
  http,
  parseAbi,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { BASE_TOKENS } from "./abi";

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

export type TrackedAsset = {
  id: string;
  symbol: string;
  name: string;
  token: Address | "native";
  policyToken: Address;
  decimals: number;
  feedId: string;
  priceAsset?: string;
};

export const TRACKED_ASSETS: TrackedAsset[] = [
  {
    id: "eth",
    symbol: "ETH",
    name: "Ether (gas + wrap to WETH)",
    token: "native",
    policyToken: BASE_TOKENS.WETH as Address,
    decimals: 18,
    feedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    priceAsset: "eth",
  },
  {
    id: "weth",
    symbol: "WETH",
    name: "Wrapped Ether",
    token: BASE_TOKENS.WETH as Address,
    policyToken: BASE_TOKENS.WETH as Address,
    decimals: 18,
    feedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    priceAsset: "eth",
  },
  {
    id: "cbbtc",
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    token: BASE_TOKENS.CBBTC as Address,
    policyToken: BASE_TOKENS.CBBTC as Address,
    decimals: 8,
    feedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    priceAsset: "btc",
  },
  {
    id: "usdc",
    symbol: "USDC",
    name: "USD Coin",
    token: BASE_TOKENS.USDC as Address,
    policyToken: BASE_TOKENS.USDC as Address,
    decimals: 6,
    feedId: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    priceAsset: "usdc",
  },
  {
    id: "cbeth",
    symbol: "cbETH",
    name: "Coinbase Staked ETH",
    token: BASE_TOKENS.cbETH as Address,
    policyToken: BASE_TOKENS.cbETH as Address,
    decimals: 18,
    feedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    priceAsset: "eth",
  },
];

function rpc() {
  return process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
}

export function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(rpc(), { timeout: 20_000 }),
  });
}

export type AssetHolding = TrackedAsset & {
  balance: bigint;
  balanceFormatted: string;
  spotUsd: number | null;
  valueUsd: number | null;
};

async function fetchSpotViaApi(asset: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/pyth?asset=${asset}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { usd?: number };
    // API already rounds to cents — keep that exact number for table ↔ band match
    return typeof json.usd === "number" ? json.usd : null;
  } catch {
    return null;
  }
}

function fmt(bal: bigint, decimals: number): string {
  const n = Number(bal) / 10 ** decimals;
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toPrecision(4);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export async function fetchHoldings(owner: Address): Promise<AssetHolding[]> {
  const client = getPublicClient();

  const spotKeys = [...new Set(TRACKED_ASSETS.map((a) => a.priceAsset ?? "eth"))];
  const spotsByAsset = new Map<string, number | null>();
  await Promise.all(
    spotKeys.map(async (a) => {
      spotsByAsset.set(a, await fetchSpotViaApi(a));
    }),
  );

  const balances = await Promise.all(
    TRACKED_ASSETS.map(async (asset) => {
      try {
        if (asset.token === "native") {
          return await client.getBalance({ address: owner });
        }
        return await client.readContract({
          address: asset.token,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [owner],
        });
      } catch (e) {
        console.error("[lga] balance", asset.id, e);
        return 0n;
      }
    }),
  );

  return TRACKED_ASSETS.map((asset, i) => {
    const balance = balances[i] ?? 0n;
    const spotUsd = spotsByAsset.get(asset.priceAsset ?? "eth") ?? null;
    const balNum = Number(balance) / 10 ** asset.decimals;
    return {
      ...asset,
      balance,
      balanceFormatted:
        asset.token === "native" ? formatEther(balance) : fmt(balance, asset.decimals),
      spotUsd,
      valueUsd: spotUsd != null ? balNum * spotUsd : null,
    };
  });
}
