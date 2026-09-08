/** Shared Composable data layer — relative import (Turbopack breaks on file:/junctions). */
export {
  compareDexPools,
  compareLendingMarkets,
  composeGuardianContext,
  fetchAgent0Registry,
  decideSafestBorrow,
  decideDeepestWethPool,
  evaluateSwapGate,
  type CompareDexResult,
  type CompareLendingResult,
  type GuardianComposeContext,
  type AgentPeer,
  type DexPoolRow,
  type LendingMarketRow,
  type BorrowDecision,
  type DexDecision,
  type SwapGateResult,
} from "../../../graph-data/src/index";
