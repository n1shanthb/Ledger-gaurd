import type { DexPoolRow, LendingMarketRow } from "../types";

/** Keep top-K rows per protocolSlug so one chain doesn't drown the matrix. */
export function pickPerProtocol<T extends { protocolSlug: string }>(
  rows: T[],
  k = 2,
): T[] {
  const counts = new Map<string, number>();
  const out: T[] = [];
  for (const row of rows) {
    const n = counts.get(row.protocolSlug) ?? 0;
    if (n >= k) continue;
    counts.set(row.protocolSlug, n + 1);
    out.push(row);
  }
  return out;
}

export function matchAsset(symbol: string, want: string): boolean {
  const a = symbol.toUpperCase();
  const b = want.toUpperCase();
  if (a === b) return true;
  if (b === "USDC" && (a === "USDBC" || a === "USDC.E")) return true;
  if (b === "WETH" && (a === "ETH" || a === "WETH")) return true;
  return false;
}

export function poolHasWeth(row: DexPoolRow): boolean {
  const label = `${row.pairLabel} ${row.symbol} ${row.name}`.toUpperCase();
  return label.includes("WETH") || /(^|\/)ETH(\/|$)/.test(label);
}

/** Prefer WETH paired with majors — Messari Base Uni ranks junk TVL first. */
const MAJOR_COUNTER = new Set([
  "USDC",
  "USDBC",
  "USDC.E",
  "DAI",
  "USDT",
  "CBETH",
  "CBBTC",
  "WBTC",
  "WSTETH",
  "WEETH",
]);

export function poolIsWethMajor(row: DexPoolRow): boolean {
  if (!poolHasWeth(row)) return false;
  const toks = row.pairLabel
    .toUpperCase()
    .split(/[/\-]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return toks.some((t) => MAJOR_COUNTER.has(t));
}

/** Drop absurd BigDecimal spikes; keep plausible USD TVL. */
export function poolTvlSane(row: DexPoolRow): boolean {
  return row.totalValueLockedUSD > 10_000 && row.totalValueLockedUSD < 2e9;
}

export type ProvenanceChip = {
  deploymentId: string;
  protocolSlug: string;
  network: string;
  blockNumber: number;
};

export function provenanceFromLending(rows: LendingMarketRow[]): ProvenanceChip[] {
  const seen = new Set<string>();
  const out: ProvenanceChip[] = [];
  for (const r of rows) {
    if (seen.has(r.deploymentId)) continue;
    seen.add(r.deploymentId);
    out.push({
      deploymentId: r.deploymentId,
      protocolSlug: r.protocolSlug,
      network: r.network,
      blockNumber: r.blockNumber,
    });
  }
  return out;
}

export function provenanceFromDex(rows: DexPoolRow[]): ProvenanceChip[] {
  const seen = new Set<string>();
  const out: ProvenanceChip[] = [];
  for (const r of rows) {
    if (seen.has(r.deploymentId)) continue;
    seen.add(r.deploymentId);
    out.push({
      deploymentId: r.deploymentId,
      protocolSlug: r.protocolSlug,
      network: r.network,
      blockNumber: r.blockNumber,
    });
  }
  return out;
}
