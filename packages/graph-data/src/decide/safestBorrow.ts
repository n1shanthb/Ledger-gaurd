import { compareLendingMarkets } from "../fetch/compareLendingMarkets";
import type { LendingMarketRow } from "../types";
import {
  matchAsset,
  pickPerProtocol,
  provenanceFromLending,
  type ProvenanceChip,
} from "./helpers";

export type BorrowDecision = {
  winner: LendingMarketRow | null;
  runnersUp: LendingMarketRow[];
  matrix: LendingMarketRow[];
  verdict: string;
  provenance: ProvenanceChip[];
  deploymentsOk: number;
  failed: { protocolSlug: string; network: string; error: string }[];
};

const MIN_TVL_USD = 50_000;

/**
 * Safest borrow = lowest utilization among markets for `assetSymbol` with meaningful TVL.
 * Default Base-only winner; cross-chain peers appear in runnersUp / matrix.
 */
export async function decideSafestBorrow(opts?: {
  assetSymbol?: string;
  /** Network for the primary verdict (default base). */
  network?: "base" | "ethereum" | "optimism" | "arbitrum";
  first?: number;
}): Promise<BorrowDecision> {
  const asset = opts?.assetSymbol ?? "USDC";
  const focusNet = opts?.network ?? "base";
  const { markets, failed, deploymentsOk } = await compareLendingMarkets({
    first: opts?.first ?? 25,
    baseOnly: false,
  });

  const matched = markets.filter(
    (m) =>
      matchAsset(m.assetSymbol, asset) &&
      m.totalValueLockedUSD >= MIN_TVL_USD &&
      m.utilization != null &&
      Number.isFinite(m.utilization),
  );

  const basePool = matched
    .filter((m) => m.network === focusNet)
    .sort((a, b) => (a.utilization ?? 1) - (b.utilization ?? 1));

  const cross = matched
    .filter((m) => m.network !== focusNet)
    .sort((a, b) => (a.utilization ?? 1) - (b.utilization ?? 1));

  const winner = basePool[0] ?? null;
  const runnersUp = [
    ...basePool.slice(1, 4),
    ...cross.slice(0, 4),
  ];

  const matrix = pickPerProtocol(
    [...basePool, ...cross].sort(
      (a, b) => (a.utilization ?? 1) - (b.utilization ?? 1),
    ),
    2,
  );

  let verdict: string;
  if (!winner) {
    verdict = `No ${asset} markets ≥$${MIN_TVL_USD} TVL on ${focusNet} from live Messari fan-out.`;
  } else {
    const utilPct = ((winner.utilization ?? 0) * 100).toFixed(1);
    verdict = `Safest ${focusNet} ${asset} borrow → ${winner.protocolSlug} util ${utilPct}% (TVL $${Math.round(winner.totalValueLockedUSD).toLocaleString("en-US")})`;
  }

  return {
    winner,
    runnersUp,
    matrix,
    verdict,
    provenance: provenanceFromLending(matched.length ? matched : markets),
    deploymentsOk,
    failed,
  };
}
