const HERMES = process.env.PYTH_PRICE_SERVICE_URL ?? "https://hermes.pyth.network";

export const ETH_USD =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
export const BTC_USD =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
export const USDC_USD =
  "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

const CBBTC = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

export function feedForToken(token: string): string {
  const t = token.toLowerCase();
  if (t === USDC) return USDC_USD;
  if (t === CBBTC) return BTC_USD;
  return ETH_USD;
}

export async function fetchSpotUsd1e8(feedId: string): Promise<bigint> {
  const id = feedId.replace(/^0x/, "");
  const res = await fetch(`${HERMES}/v2/updates/price/latest?ids[]=${id}`);
  if (!res.ok) throw new Error(`hermes ${res.status}`);
  const json = (await res.json()) as {
    parsed?: { price?: { price?: string; expo?: number } }[];
  };
  const p = json.parsed?.[0]?.price;
  if (!p?.price) throw new Error("hermes empty");
  return toUsd1e8(BigInt(p.price), p.expo ?? -8);
}

export async function fetchVaas(feedId: string): Promise<`0x${string}`[]> {
  const id = feedId.replace(/^0x/, "");
  const res = await fetch(`${HERMES}/v2/updates/price/latest?ids[]=${id}&encoding=hex`);
  if (!res.ok) throw new Error(`hermes vaa ${res.status}`);
  const json = (await res.json()) as { binary?: { data?: string[] } };
  const data = json.binary?.data ?? [];
  if (!data.length) throw new Error("no vaa");
  return data.map((d) => (d.startsWith("0x") ? d : `0x${d}`)) as `0x${string}`[];
}

function toUsd1e8(price: bigint, expo: number): bigint {
  const e = expo + 8;
  if (e >= 0) return price * 10n ** BigInt(e);
  return price / 10n ** BigInt(-e);
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
