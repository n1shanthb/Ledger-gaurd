import { compareDexPools } from "../fetch/compareDexPools";
import type { DexPoolRow } from "../types";
import {
  pickPerProtocol,
  poolIsWethMajor,
  poolTvlSane,
  provenanceFromDex,
  type ProvenanceChip,
} from "./helpers";

export type DexDecision = {
  winner: DexPoolRow | null;
  runnersUp: DexPoolRow[];
  matrix: DexPoolRow[];
  verdict: string;
  provenance: ProvenanceChip[];
  deploymentsOk: number;
  failed: { protocolSlug: string; network: string; error: string }[];
};

function rankWeth(pools: DexPoolRow[]): DexPoolRow[] {
  return pools
    .filter(poolIsWethMajor)
    .filter(poolTvlSane)
    .sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD);
}

/**
 * Deepest WETH major pool by TVL.
 * baseOnly prefers a Base winner when present; still fans out OP/ARB in parallel
 * so Messari Base junk-TVL doesn't blank the demo.
 */
export async function decideDeepestWethPool(opts?: {
  baseOnly?: boolean;
  first?: number;
}): Promise<DexDecision> {
  const preferBase = opts?.baseOnly ?? true;
  const first = opts?.first ?? 8;

  // Parallel fan-out (Base+OP+ARB) — sequential Base-then-fallback was ~2× Gateway time.
  const { pools, failed, deploymentsOk } = await compareDexPools({
    first,
    baseOnly: false,
  });

  const ranked = rankWeth(pools);
  const baseHits = ranked.filter((p) => p.network === "base");
  const usedFallback = preferBase && baseHits.length === 0 && ranked.length > 0;
  const wethPools =
    preferBase && baseHits.length
      ? [...baseHits, ...ranked.filter((p) => p.network !== "base")]
      : ranked;

  const winner = wethPools[0] ?? null;
  const runnersUp = wethPools.slice(1, 6);
  const matrix = pickPerProtocol(wethPools, 2);

  let verdict: string;
  if (!winner) {
    verdict = "No reliable WETH–major depth from Messari DEX fan-out.";
  } else {
    const tvl = Math.round(winner.totalValueLockedUSD).toLocaleString("en-US");
    verdict = `Deepest WETH pool → ${winner.pairLabel} on ${winner.protocolSlug}/${winner.network} TVL $${tvl}`;
    if (usedFallback) {
      verdict += " (Base Messari TVL rank noisy — used cross-chain majors)";
    }
  }

  return {
    winner,
    runnersUp,
    matrix,
    verdict,
    provenance: provenanceFromDex(wethPools.length ? wethPools : pools),
    deploymentsOk,
    failed,
  };
}
