import { fanOutStandardQuery } from "../fanOut";
import { normalizeLendingMarkets } from "../normalize/lending";
import {
  LENDING_STANDARD_QUERY,
  type LendingStandardData,
} from "../queries/lendingStandard";
import type { LendingMarketRow } from "../types";
import type { FanOutFailure } from "../fanOut";

export type CompareLendingResult = {
  markets: LendingMarketRow[];
  failed: FanOutFailure[];
  deploymentsOk: number;
};

export async function compareLendingMarkets(opts?: {
  first?: number;
  baseOnly?: boolean;
}): Promise<CompareLendingResult> {
  const first = opts?.first ?? 10;
  const { ok, failed } = await fanOutStandardQuery<LendingStandardData>({
    family: "lending-cdp",
    document: LENDING_STANDARD_QUERY,
    variables: { first },
    network: opts?.baseOnly === false ? undefined : "base",
  });
  return {
    markets: normalizeLendingMarkets(ok),
    failed,
    deploymentsOk: ok.length,
  };
}
