import { describe, expect, it } from "vitest";
import {
  compareDexPools,
  compareLendingMarkets,
  composeGuardianContext,
  deploymentsFor,
  DEX_STANDARD_QUERY,
  fanOutStandardQuery,
  fetchAgent0Registry,
  getGraphApiKey,
  LENDING_STANDARD_QUERY,
  type DexStandardData,
  type LendingStandardData,
} from "../index";

function hasKey(): boolean {
  try {
    getGraphApiKey();
    return true;
  } catch {
    return false;
  }
}

const describeLive = hasKey() ? describe : describe.skip;

describeLive("fanOut live gateway", () => {
  it("same lending document hits ≥2 Base deployments", async () => {
    const enabled = deploymentsFor("lending-cdp", {
      network: "base",
      enabledOnly: true,
    });
    expect(enabled.length).toBeGreaterThanOrEqual(2);

    const { ok, failed } = await fanOutStandardQuery<LendingStandardData>({
      family: "lending-cdp",
      document: LENDING_STANDARD_QUERY,
      variables: { first: 3 },
      network: "base",
    });

    expect(ok.length).toBeGreaterThanOrEqual(2);
    for (const r of ok) {
      expect(r.blockNumber).toBeGreaterThan(0);
      expect(r.deploymentId).toBeTruthy();
      expect(r.data.markets?.length).toBeGreaterThan(0);
      expect(r.data.markets[0]?.totalValueLockedUSD).toBeDefined();
      expect(r.schemaVersion).toBeTruthy();
    }
    // failures are allowed for unhealthy indexers but we need ≥2 ok
    expect(failed.length + ok.length).toBe(enabled.length);
  });

  it("same DEX document hits ≥2 deployments", async () => {
    const enabled = deploymentsFor("dex-amm-extended", { enabledOnly: true });
    expect(enabled.length).toBeGreaterThanOrEqual(2);

    const { ok } = await fanOutStandardQuery<DexStandardData>({
      family: "dex-amm-extended",
      document: DEX_STANDARD_QUERY,
      variables: { first: 3 },
    });

    expect(ok.length).toBeGreaterThanOrEqual(2);
    for (const r of ok) {
      expect(r.blockNumber).toBeGreaterThan(0);
      expect(r.data.liquidityPools?.length).toBeGreaterThan(0);
      expect(r.data.liquidityPools[0]?.totalValueLockedUSD).toBeDefined();
    }
  });

  it("compareLendingMarkets merges provenance-tagged rows", async () => {
    const res = await compareLendingMarkets({ first: 5, baseOnly: true });
    expect(res.deploymentsOk).toBeGreaterThanOrEqual(2);
    expect(res.markets.length).toBeGreaterThan(0);
    const slugs = new Set(res.markets.map((m) => m.protocolSlug));
    expect(slugs.size).toBeGreaterThanOrEqual(2);
    expect(res.markets[0]?.deploymentId).toBeTruthy();
    expect(res.markets[0]?.blockNumber).toBeGreaterThan(0);
  });

  it("compareDexPools returns provenance-tagged pools", async () => {
    const res = await compareDexPools({ first: 5 });
    expect(res.deploymentsOk).toBeGreaterThanOrEqual(1);
    expect(res.pools.length).toBeGreaterThan(0);
    expect(res.pools[0]?.deploymentId).toBeTruthy();
  });
});

describeLive("compose + agent0 live", () => {
  it("composeGuardianContext merges Studio + Messari", async () => {
    const ctx = await composeGuardianContext({
      marketFirst: 3,
      poolFirst: 3,
      peerFirst: 5,
    });
    expect(
      ctx.provenance.lendingDeploymentsOk + ctx.provenance.dexDeploymentsOk,
    ).toBeGreaterThan(0);
    // Receipt Graph should return array (may be empty if no policies)
    expect(Array.isArray(ctx.policies)).toBe(true);
    expect(ctx.provenance.receiptGraphUrl).toContain("ledger-guardian-agent");
  });

  it("fetchAgent0Registry returns live _meta", async () => {
    const res = await fetchAgent0Registry({ first: 5 });
    expect(res.blockNumber).toBeGreaterThan(0);
    expect(res.deploymentId).toBeTruthy();
    expect(Array.isArray(res.peers)).toBe(true);
  });
});
