import { decideSafestBorrow, type BorrowDecision } from "./safestBorrow";
import { decideDeepestWethPool, type DexDecision } from "./deepestWeth";

export type SwapGateResult = {
  proceed: boolean;
  reasons: string[];
  lending: BorrowDecision;
  dex: DexDecision;
};

/**
 * Gate a Guardian swap using Messari fan-out decisions (same query shape as UI).
 */
export async function evaluateSwapGate(opts?: {
  maxUtil?: number;
  minPoolTvlUsd?: number;
  assetSymbol?: string;
  /** When true, deepest pool includes Optimism too (slower). */
  crossChainDex?: boolean;
  snappy?: boolean;
}): Promise<SwapGateResult> {
  const maxUtil = opts?.maxUtil ?? 0.9;
  const minPoolTvlUsd = opts?.minPoolTvlUsd ?? 100_000;
  const snappy = opts?.snappy ?? true;

  const [lending, dex] = await Promise.all([
    decideSafestBorrow({
      assetSymbol: opts?.assetSymbol ?? "USDC",
      network: "base",
      snappy,
    }),
    decideDeepestWethPool({
      baseOnly: !opts?.crossChainDex,
      snappy: opts?.crossChainDex ? false : snappy,
    }),
  ]);

  const reasons: string[] = [];

  // Warn on any Base USDC market above max util (Compound often hot)
  const hot = lending.matrix.filter(
    (m) =>
      m.network === "base" &&
      m.utilization != null &&
      m.utilization > maxUtil,
  );
  for (const m of hot) {
    reasons.push(
      `High util on ${m.protocolSlug} ${m.assetSymbol}: ${((m.utilization ?? 0) * 100).toFixed(1)}% > ${(maxUtil * 100).toFixed(0)}%`,
    );
  }

  if (!dex.winner) {
    reasons.push("No WETH pool depth from Messari DEX fan-out");
  } else if (dex.winner.totalValueLockedUSD < minPoolTvlUsd) {
    reasons.push(
      `Deepest WETH pool TVL $${Math.round(dex.winner.totalValueLockedUSD).toLocaleString()} < $${minPoolTvlUsd.toLocaleString()} floor`,
    );
  }

  const proceed = reasons.length === 0;
  if (proceed) {
    reasons.push(
      lending.verdict,
      dex.verdict,
      "Gate clear — OK to route / requestExecutionAttempt",
    );
  }

  return { proceed, reasons, lending, dex };
}
