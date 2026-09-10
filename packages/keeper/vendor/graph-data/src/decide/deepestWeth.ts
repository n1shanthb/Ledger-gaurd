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
 * Default snappy path: Base + Arbitrum (skip Optimism — often stalls Gateway).
 */
export async function decideDeepestWethPool(opts?: {
  baseOnly?: boolean;
  first?: number;
  snappy?: boolean;
}): Promise<DexDecision> {
  const preferBase = opts?.baseOnly ?? true;
  const snappy = opts?.snappy ?? true;
  // OP Messari Uni is the usual timeout culprit — only include when not snappy.
  const networks = snappy
    ? (["base", "arbitrum"] as const)
    : (["base", "optimism", "arbitrum"] as const);

  const { pools, failed, deploymentsOk } = await compareDexPools({
    first: opts?.first ?? (snappy ? 5 : 8),
    networks: [...networks],
    snappy,
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
