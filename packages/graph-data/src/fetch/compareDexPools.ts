import { fanOutStandardQuery } from "../fanOut";
import { normalizeDexPools } from "../normalize/dex";
import { DEX_STANDARD_QUERY, type DexStandardData } from "../queries/dexStandard";
import type { DexPoolRow } from "../types";
import type { FanOutFailure } from "../fanOut";

export type CompareDexResult = {
  pools: DexPoolRow[];
  failed: FanOutFailure[];
  deploymentsOk: number;
};

export async function compareDexPools(opts?: {
  first?: number;
  /** Prefer Base when set; default all enabled dex-amm-extended */
  baseOnly?: boolean;
}): Promise<CompareDexResult> {
  const first = opts?.first ?? 8;
  const { ok, failed } = await fanOutStandardQuery<DexStandardData>({
    family: "dex-amm-extended",
    document: DEX_STANDARD_QUERY,
    variables: { first },
    network: opts?.baseOnly ? "base" : undefined,
    requestOpts: { timeoutMs: 25_000, maxAttempts: 2 },
  });
  return {
    pools: normalizeDexPools(ok),
    failed,
    deploymentsOk: ok.length,
  };
}
