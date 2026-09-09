import { fanOutStandardQuery } from "../fanOut";
import { normalizeDexPools } from "../normalize/dex";
import { DEX_STANDARD_QUERY, type DexStandardData } from "../queries/dexStandard";
import { deploymentsFor, type DeploymentEntry } from "../registry";
import type { FanOutFailure } from "../fanOut";

export type CompareDexResult = {
  pools: ReturnType<typeof normalizeDexPools>;
  failed: FanOutFailure[];
  deploymentsOk: number;
};

export async function compareDexPools(opts?: {
  first?: number;
  /** Prefer Base when set; ignored if `networks` is set */
  baseOnly?: boolean;
  networks?: DeploymentEntry["network"][];
  /** Shorter timeouts + fewer retries for UI */
  snappy?: boolean;
}): Promise<CompareDexResult> {
  const snappy = opts?.snappy ?? false;
  const first = opts?.first ?? (snappy ? 5 : 8);

  let deployments = deploymentsFor("dex-amm-extended", {
    enabledOnly: true,
    network: opts?.networks?.length
      ? undefined
      : opts?.baseOnly
        ? "base"
        : undefined,
  });
  if (opts?.networks?.length) {
    const want = new Set(opts.networks);
    deployments = deployments.filter((d) => want.has(d.network));
  }

  const { ok, failed } = await fanOutStandardQuery<DexStandardData>({
    family: "dex-amm-extended",
    document: DEX_STANDARD_QUERY,
    variables: { first },
    deployments,
    requestOpts: snappy
      ? { timeoutMs: 12_000, maxAttempts: 1 }
      : { timeoutMs: 22_000, maxAttempts: 2 },
  });
  return {
    pools: normalizeDexPools(ok),
    failed,
    deploymentsOk: ok.length,
  };
}
