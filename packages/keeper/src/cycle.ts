import type { Hex } from "viem";
import { fetchActivePolicies, type PolicyRow } from "./subgraph";
import { feedForToken, fetchSpotUsd1e8, fetchVaas, shouldTrigger } from "./pyth";
import { executePolicy } from "./executor";
import type { KeeperSecrets } from "./ring";
import type { PaymentHit } from "./payments";
import { createCapabilityBroker, stampCapability } from "./capabilities";

export type CycleOpts = {
  execute: boolean;
};

export type CycleResult = {
  evaluated: number;
  executed: PaymentHit[];
  skips: { policyId: string; spot: number; stop: number; take: number }[];
  note?: string;
};

export async function runCycle(
  secrets: KeeperSecrets,
  opts: CycleOpts = { execute: true },
): Promise<CycleResult> {
  const broker = createCapabilityBroker(secrets);
  stampCapability(broker, "read:graph", 30_000);
  stampCapability(broker, "read:pyth", 30_000);
  const policies = await fetchActivePolicies(secrets.graphUrl, secrets.graphApiKey);
  const hits: PaymentHit[] = [];
  const skips: CycleResult["skips"] = [];

  for (const pol of policies) {
    const feed = feedForToken(pol.token);
    const spot = await fetchSpotUsd1e8(feed);
    const trigger = shouldTrigger(
      spot,
      BigInt(pol.stopLossPrice),
      BigInt(pol.takeProfitPrice),
    );
    if (!trigger) {
      const row = {
        policyId: pol.id,
        spot: Number(spot) / 1e8,
        stop: Number(pol.stopLossPrice) / 1e8,
        take: Number(pol.takeProfitPrice) / 1e8,
      };
      skips.push(row);
      console.log(
        `[lga] Autopilot skip ${pol.id.slice(0, 10)}… spot=${row.spot} stop=${row.stop} take=${row.take}`,
      );
      continue;
    }

    console.log(
      `[lga] Autopilot hit ${trigger} ${pol.id.slice(0, 10)}… ${opts.execute ? "executing" : "quote-only"}`,
    );
    if (!opts.execute) {
      hits.push({ policyId: pol.id, trigger });
      continue;
    }

    const vaas = await fetchVaas(feed);
    const tx = await executePolicy({
      rpc: secrets.baseRpc,
      sessionKey: secrets.sessionKey,
      manager: secrets.manager,
      policyId: pol.id as Hex,
      vaas,
      secrets,
      mintInternal: true,
    });
    hits.push({ policyId: pol.id, trigger, tx });
    console.log(`[lga] Driver filled ${tx}`);
  }

  return {
    evaluated: policies.length,
    executed: hits,
    skips,
    note:
      hits.length === 0 && policies.length > 0
        ? "No policy in range — wait for band or Instant-fill"
        : undefined,
  };
}

export async function findHitPolicies(secrets: KeeperSecrets): Promise<
  { pol: PolicyRow; trigger: string; spot: bigint }[]
> {
  const broker = createCapabilityBroker(secrets);
  stampCapability(broker, "read:graph", 30_000);
  stampCapability(broker, "read:pyth", 30_000);
  const policies = await fetchActivePolicies(secrets.graphUrl, secrets.graphApiKey);
  const out: { pol: PolicyRow; trigger: string; spot: bigint }[] = [];
  for (const pol of policies) {
    const feed = feedForToken(pol.token);
    const spot = await fetchSpotUsd1e8(feed);
    const trigger = shouldTrigger(
      spot,
      BigInt(pol.stopLossPrice),
      BigInt(pol.takeProfitPrice),
    );
    if (trigger) out.push({ pol, trigger, spot });
  }
  return out;
}
