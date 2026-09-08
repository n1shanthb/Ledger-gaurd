export const GPM_V2 =
  (process.env.NEXT_PUBLIC_GUARDIAN_POLICY_MANAGER as `0x${string}` | undefined) ??
  ("0xdBf463E260573797Dd1a03B4f45876aad777453b" as const);
export const SESSION_VALIDATOR =
  (process.env.NEXT_PUBLIC_SESSION_VALIDATOR as `0x${string}` | undefined) ??
  ("0xf93f56DF8481144F507dFCf30712658202E164e4" as const);
export const SWAP_EXECUTOR =
  "0x4767a9Deee297d73B72cDD850850D11B221034Ab" as const;

export const SUBGRAPH_QUERY_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_QUERY_URL ??
  "https://api.studio.thegraph.com/query/1758709/ledger-guardian-agent/v0.0.4";

export const STUDIO_URL =
  "https://thegraph.com/studio/subgraph/ledger-guardian-agent";

export const BASESCAN_GPM = `https://basescan.org/address/${GPM_V2}`;

export const POLICY_TX =
  "https://basescan.org/tx/0x6c249efd8f5dcec73b33fc6d155e24f7f53274f2fb167bf8f6eae6d7cc27a7a9";

export const KILL_TX =
  "https://basescan.org/tx/0x6a93c38a2278ffa2fbbdc7dbc76c642c6702a5102ff45053faeef55978895b8b";

export const BASE_TOKENS: Record<string, string> = {
  "0x4200000000000000000000000000000000000006": "ETH (WETH)",
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "BTC (cbBTC)",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": "cbETH",
};

export function tokenLabel(addr: string): string {
  return BASE_TOKENS[addr.toLowerCase()] ?? `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function usdNumberFrom1e8(v: string | number | bigint): number | null {
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / 1e8;
}

export function usdFrom1e8(v: string | number | bigint): string {
  const n = usdNumberFrom1e8(v);
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
