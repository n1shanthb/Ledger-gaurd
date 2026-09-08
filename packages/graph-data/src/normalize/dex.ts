import type { FanOutResult } from "../fanOut";
import type { DexStandardData } from "../queries/dexStandard";
import type { DexPoolRow } from "../types";

function num(v: string | number | undefined | null): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeDexPools(
  results: FanOutResult<DexStandardData>[],
): DexPoolRow[] {
  const rows: DexPoolRow[] = [];
  for (const r of results) {
    for (const p of r.data.liquidityPools ?? []) {
      const symbols = (p.inputTokens ?? []).map((t) => t.symbol).filter(Boolean);
      rows.push({
        deploymentId: r.deploymentId,
        protocolSlug: r.protocolSlug,
        network: r.network,
        schemaVersion: r.schemaVersion,
        methodologyVersion: r.methodologyVersion,
        blockNumber: r.blockNumber,
        poolId: p.id,
        name: p.name,
        symbol: p.symbol,
        pairLabel: symbols.length ? symbols.join("/") : p.symbol || p.name,
        totalValueLockedUSD: num(p.totalValueLockedUSD),
        cumulativeVolumeUSD: num(p.cumulativeVolumeUSD ?? 0),
      });
    }
  }
  return rows.sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD);
}
