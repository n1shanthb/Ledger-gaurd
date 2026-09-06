import {
  createPublicClient,
  fallback,
  formatEther,
  formatUnits,
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

function rpcUrls(): string[] {
  const primary = process.env.NEXT_PUBLIC_BASE_RPC_URL;
  const list = [
    primary,
    "https://base.publicnode.com",
    "https://mainnet.base.org",
  ].filter((u): u is string => Boolean(u));
  return [...new Set(list)];
}

export function getPublicClient() {
  const urls = rpcUrls();
  return createPublicClient({
    chain: base,
    transport: fallback(
      urls.map((url) => http(url, { timeout: 25_000, retryCount: 1 })),
    ),
  });
}

export type AssetHolding = TrackedAsset & {
  balance: bigint;
  balanceFormatted: string;
  /** false when RPC read failed — do not treat as zero */
  balanceOk: boolean;
  spotUsd: number | null;
  valueUsd: number | null;
};

async function fetchSpotViaApi(asset: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/pyth?asset=${asset}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { usd?: number };
    return typeof json.usd === "number" ? json.usd : null;
  } catch {
    return null;
  }
}

function fmt(bal: bigint, decimals: number): string {
  const s = formatUnits(bal, decimals);
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return "0";
  // Always plain decimal (no 9.99e-5) — trim trailing zeros, keep up to 8 dp.
  const fixed = n.toFixed(Math.min(8, decimals));
  return fixed.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "").replace(/\.$/, "");
}

async function readBalances(owner: Address): Promise<{
  amounts: (bigint | null)[];
}> {
  const client = getPublicClient();
  const erc20 = TRACKED_ASSETS.filter((a) => a.token !== "native");

  const [ethBal, multicall] = await Promise.all([
    client.getBalance({ address: owner }).catch((e) => {
      console.error("[lga] eth balance", e);
      return null as bigint | null;
    }),
    client
      .multicall({
        allowFailure: true,
        contracts: erc20.map((asset) => ({
          address: asset.token as Address,
          abi: ERC20_ABI,
          functionName: "balanceOf" as const,
          args: [owner] as const,
        })),
      })
      .catch((e) => {
        console.error("[lga] multicall balances", e);
        return null;
      }),
  ]);

  const byId = new Map<string, bigint | null>();
  byId.set("eth", ethBal);

  if (multicall) {
    erc20.forEach((asset, i) => {
      const row = multicall[i];
      byId.set(
        asset.id,
        row?.status === "success" ? (row.result as bigint) : null,
      );
    });
  } else {
    // Fallback: one-by-one if multicall blows up
    await Promise.all(
      erc20.map(async (asset) => {
        try {
          const bal = await client.readContract({
            address: asset.token as Address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [owner],
          });
          byId.set(asset.id, bal);
        } catch (e) {
          console.error("[lga] balance", asset.id, e);
          byId.set(asset.id, null);
        }
      }),
    );
  }

  return {
    amounts: TRACKED_ASSETS.map((a) => byId.get(a.id) ?? null),
  };
}

export async function fetchHoldings(owner: Address): Promise<AssetHolding[]> {
  const spotKeys = [...new Set(TRACKED_ASSETS.map((a) => a.priceAsset ?? "eth"))];
  const spotsByAsset = new Map<string, number | null>();

  const [spotsSettled, { amounts }] = await Promise.all([
    Promise.all(
      spotKeys.map(async (a) => {
        spotsByAsset.set(a, await fetchSpotViaApi(a));
      }),
    ),
    readBalances(owner),
  ]);
  void spotsSettled;

  return TRACKED_ASSETS.map((asset, i) => {
    const raw = amounts[i];
    const balanceOk = raw != null;
    const balance = raw ?? 0n;
    const spotUsd = spotsByAsset.get(asset.priceAsset ?? "eth") ?? null;
    const balNum = balanceOk ? Number(formatUnits(balance, asset.decimals)) : 0;
    return {
      ...asset,
      balance,
      balanceOk,
      balanceFormatted:
        !balanceOk
          ? "—"
          : asset.token === "native"
            ? formatEther(balance)
            : fmt(balance, asset.decimals),
      spotUsd,
      valueUsd: balanceOk && spotUsd != null ? balNum * spotUsd : null,
    };
  });
}
