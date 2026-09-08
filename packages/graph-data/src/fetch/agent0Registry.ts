import { gatewayRequest } from "../client";
import { AGENT0_ID, deploymentsFor } from "../registry";
import {
  AGENT0_META_ONLY,
  AGENT0_REGISTRY_QUERY,
  type Agent0RegistryData,
  type Agent0RawAgent,
} from "../queries/agent0";
import { normalizeAgent0 } from "../normalize/agent0";
import type { AgentPeer } from "../types";

const INTROSPECT_TYPES = `
query IntrospectAgentRoot {
  __schema {
    queryType {
      fields { name }
    }
  }
}
`;

function pickAgentField(names: string[]): string | null {
  const preferred = [
    "agents",
    "agentRecords",
    "registrations",
    "identities",
    "agentIdentities",
    "erc8004Agents",
  ];
  for (const p of preferred) {
    if (names.includes(p)) return p;
  }
  return names.find((n) => /agent/i.test(n) && n !== "_meta") ?? null;
}

async function fetchViaIntrospect(
  deploymentId: string,
  first: number,
): Promise<Agent0RegistryData> {
  const schema = await gatewayRequest<{
    __schema: { queryType: { fields: { name: string }[] } };
  }>(deploymentId, INTROSPECT_TYPES);
  const names = schema.__schema.queryType.fields.map((f) => f.name);
  const root = pickAgentField(names);
  if (!root) {
    const meta = await gatewayRequest<{ _meta: { block: { number: number } } }>(
      deploymentId,
      AGENT0_META_ONLY,
    );
    return { _meta: meta._meta, agents: [] };
  }

  const doc = `
    query Agent0Dynamic($first: Int!) {
      _meta { block { number } }
      ${root}(first: $first) {
        id
      }
    }
  `;
  const data = await gatewayRequest<Record<string, unknown>>(
    deploymentId,
    doc,
    { first },
  );
  const list = (data[root] as Agent0RawAgent[] | undefined) ?? [];
  return {
    _meta: data._meta as { block: { number: number } },
    agents: list.map((a) => ({
      id: a.id,
      name: (a as Agent0RawAgent).name,
      mcpEndpoint: (a as Agent0RawAgent).mcpEndpoint,
      a2aEndpoint: (a as Agent0RawAgent).a2aEndpoint,
      trustScore: (a as Agent0RawAgent).trustScore,
      metadata: (a as Agent0RawAgent).metadata,
    })),
  };
}

export async function fetchAgent0Registry(opts?: {
  first?: number;
}): Promise<{
  peers: AgentPeer[];
  blockNumber: number;
  deploymentId: string;
  error?: string;
}> {
  const first = opts?.first ?? 25;
  const entry =
    deploymentsFor("agent0")[0] ??
    ({
      deploymentId: AGENT0_ID,
      protocolSlug: "agent0",
      network: "base" as const,
      schemaVersion: "1.0.0",
    } as const);

  try {
    let data: Agent0RegistryData;
    try {
      data = await gatewayRequest<Agent0RegistryData>(
        entry.deploymentId,
        AGENT0_REGISTRY_QUERY,
        { first },
      );
    } catch {
      data = await fetchViaIntrospect(entry.deploymentId, first);
    }

    const peers = normalizeAgent0([
      {
        deploymentId: entry.deploymentId,
        protocolSlug: entry.protocolSlug,
        network: entry.network,
        schemaVersion: entry.schemaVersion,
        blockNumber: data._meta.block.number,
        data,
      },
    ]);

    return {
      peers,
      blockNumber: data._meta.block.number,
      deploymentId: entry.deploymentId,
    };
  } catch (e) {
    return {
      peers: [],
      blockNumber: 0,
      deploymentId: entry.deploymentId,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
