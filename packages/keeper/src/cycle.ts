import type { Hex } from "viem";
import { fetchActivePolicies, type PolicyRow } from "./subgraph";
import {
  confirmTriggerForExecute,
  feedForToken,
  fetchVaas,
} from "./pyth";
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
    const stop = BigInt(pol.stopLossPrice);
    const take = BigInt(pol.takeProfitPrice);
    const conf = await confirmTriggerForExecute(feed, stop, take);
    if (!conf.ok) {
      const row = {
        policyId: pol.id,
        spot: Number(conf.spot ?? 0) / 1e8,
        stop: Number(stop) / 1e8,
        take: Number(take) / 1e8,
      };
      skips.push(row);
      console.log(
        `[lga] Autopilot skip ${pol.id.slice(0, 10)}… ${conf.reason}`,
      );
      continue;
    }

    console.log(
      `[lga] Autopilot hit ${conf.trigger} ${pol.id.slice(0, 10)}… spot=${Number(conf.spot) / 1e8} ${opts.execute ? "executing" : "quote-only"}`,
    );
    if (!opts.execute) {
      hits.push({ policyId: pol.id, trigger: conf.trigger });
      continue;
    }

    const vaas = await fetchVaas(feed);
    const conf2 = await confirmTriggerForExecute(feed, stop, take);
    if (!conf2.ok) {
      console.log(
        `[lga] Autopilot abort ${pol.id.slice(0, 10)}… after VAA fetch: ${conf2.reason}`,
      );
      skips.push({
        policyId: pol.id,
        spot: Number(conf2.spot ?? conf.spot) / 1e8,
        stop: Number(stop) / 1e8,
        take: Number(take) / 1e8,
      });
      continue;
    }

    try {
      const tx = await executePolicy({
        rpc: secrets.baseRpc,
        sessionKey: secrets.sessionKey,
        manager: secrets.manager,
        policyId: pol.id as Hex,
        vaas,
        secrets,
        mintInternal: true,
      });
      hits.push({ policyId: pol.id, trigger: conf2.trigger, tx });
      console.log(`[lga] Driver filled ${tx}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        `[lga] Driver execute failed ${pol.id.slice(0, 10)}…`,
        msg.slice(0, 240),
      );
      if (/not triggered/i.test(msg)) {
        skips.push({
          policyId: pol.id,
          spot: Number(conf2.spot) / 1e8,
          stop: Number(stop) / 1e8,
          take: Number(take) / 1e8,
        });
        continue;
      }
      throw e;
    }
  }

  return {
    evaluated: policies.length,
    executed: hits,
    skips,
    note:
      hits.length === 0 && policies.length > 0
        ? "No policy in range — wait for latest Pyth to cross the clear-signed band"
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
    const stop = BigInt(pol.stopLossPrice);
    const take = BigInt(pol.takeProfitPrice);
    const conf = await confirmTriggerForExecute(feed, stop, take);
    if (!conf.ok) continue;
    out.push({ pol, trigger: conf.trigger, spot: conf.spot });
  }
  return out;
}
