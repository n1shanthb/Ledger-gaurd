import { getReceiptGraphUrl, requestWithRetry } from "../client";
import { compareDexPools } from "../fetch/compareDexPools";
import { compareLendingMarkets } from "../fetch/compareLendingMarkets";
import { fetchAgent0Registry } from "../fetch/agent0Registry";
import type {
  AgentPeer,
  DexPoolRow,
  LendingMarketRow,
  ReceiptPolicy,
} from "../types";

async function fetchReceiptPolicies(first = 20): Promise<ReceiptPolicy[]> {
  const url = getReceiptGraphUrl();
  const headers: Record<string, string> = {};
  const studioKey =
    process.env.GRAPH_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GRAPH_API_KEY?.trim();
  // Studio / Gateway both accept Bearer when API key is set.
  if (studioKey && /thegraph\.com/.test(url)) {
    headers.Authorization = `Bearer ${studioKey}`;
  }

  const data = await requestWithRetry<{ policies: ReceiptPolicy[] }>(
    url,
    `{
      policies(first: ${first}, orderBy: createdAt, orderDirection: desc) {
        id owner token policyType stopLossPrice takeProfitPrice maxAmount active
      }
    }`,
    undefined,
    { headers },
  );
  return data.policies ?? [];
}

export type GuardianComposeContext = {
  policies: ReceiptPolicy[];
  activePolicies: ReceiptPolicy[];
  topLending: LendingMarketRow[];
  topPools: DexPoolRow[];
  peers: AgentPeer[];
  provenance: {
    lendingDeploymentsOk: number;
    dexDeploymentsOk: number;
    agent0DeploymentId?: string;
    agent0Block?: number;
    receiptGraphUrl: string;
  };
  errors: string[];
};

/** Compose Receipt Graph + Messari fan-out + Agent0 into one DTO for agents/UI. */
export async function composeGuardianContext(opts?: {
  policyFirst?: number;
  marketFirst?: number;
  poolFirst?: number;
  peerFirst?: number;
}): Promise<GuardianComposeContext> {
  const errors: string[] = [];
  const [policiesRes, lendingRes, dexRes, agentRes] = await Promise.allSettled([
    fetchReceiptPolicies(opts?.policyFirst ?? 20),
    compareLendingMarkets({ first: opts?.marketFirst ?? 5, baseOnly: true }),
    compareDexPools({ first: opts?.poolFirst ?? 5 }),
    fetchAgent0Registry({ first: opts?.peerFirst ?? 10 }),
  ]);

  const policies =
    policiesRes.status === "fulfilled" ? policiesRes.value : [];
  if (policiesRes.status === "rejected") {
    errors.push(
      `receipt: ${policiesRes.reason instanceof Error ? policiesRes.reason.message : String(policiesRes.reason)}`,
    );
  }

  const lending =
    lendingRes.status === "fulfilled"
      ? lendingRes.value
      : { markets: [], failed: [], deploymentsOk: 0 };
  if (lendingRes.status === "rejected") {
    errors.push(
      `lending: ${lendingRes.reason instanceof Error ? lendingRes.reason.message : String(lendingRes.reason)}`,
    );
  } else {
    for (const f of lending.failed) {
      errors.push(`lending ${f.protocolSlug}: ${f.error}`);
    }
  }

  const dex =
    dexRes.status === "fulfilled"
      ? dexRes.value
      : { pools: [], failed: [], deploymentsOk: 0 };
  if (dexRes.status === "rejected") {
    errors.push(
      `dex: ${dexRes.reason instanceof Error ? dexRes.reason.message : String(dexRes.reason)}`,
    );
  } else {
    for (const f of dex.failed) {
      errors.push(`dex ${f.protocolSlug}@${f.network}: ${f.error}`);
    }
  }

  let peers: AgentPeer[] = [];
  let agent0DeploymentId: string | undefined;
  let agent0Block: number | undefined;
  if (agentRes.status === "fulfilled") {
    peers = agentRes.value.peers;
    agent0DeploymentId = agentRes.value.deploymentId;
    agent0Block = agentRes.value.blockNumber;
  } else {
    errors.push(
      `agent0: ${agentRes.reason instanceof Error ? agentRes.reason.message : String(agentRes.reason)}`,
    );
  }

  return {
    policies,
    activePolicies: policies.filter((p) => p.active),
    topLending: lending.markets.slice(0, 8),
    topPools: dex.pools.slice(0, 8),
    peers,
    provenance: {
      lendingDeploymentsOk: lending.deploymentsOk,
      dexDeploymentsOk: dex.deploymentsOk,
      agent0DeploymentId,
      agent0Block,
      receiptGraphUrl: getReceiptGraphUrl(),
    },
    errors,
  };
}
