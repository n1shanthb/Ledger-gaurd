import { fanOutStandardQuery } from "../fanOut";
import { normalizeLendingMarkets } from "../normalize/lending";
import {
  LENDING_STANDARD_QUERY,
  type LendingStandardData,
} from "../queries/lendingStandard";
import type { FanOutFailure } from "../fanOut";

export type CompareLendingResult = {
  markets: ReturnType<typeof normalizeLendingMarkets>;
  failed: FanOutFailure[];
  deploymentsOk: number;
};

export async function compareLendingMarkets(opts?: {
  first?: number;
  baseOnly?: boolean;
  snappy?: boolean;
}): Promise<CompareLendingResult> {
  const snappy = opts?.snappy ?? false;
  const first = opts?.first ?? (snappy ? 12 : 10);
  const { ok, failed } = await fanOutStandardQuery<LendingStandardData>({
    family: "lending-cdp",
    document: LENDING_STANDARD_QUERY,
    variables: { first },
    network: opts?.baseOnly === false ? undefined : "base",
    requestOpts: snappy
      ? { timeoutMs: 14_000, maxAttempts: 1 }
      : { timeoutMs: 18_000, maxAttempts: 2 },
  });
  return {
    markets: normalizeLendingMarkets(ok),
    failed,
    deploymentsOk: ok.length,
  };
}
