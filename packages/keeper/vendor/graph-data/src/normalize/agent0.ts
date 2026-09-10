import type { FanOutResult } from "../fanOut";
import type { Agent0RegistryData, Agent0RawAgent } from "../queries/agent0";
import type { AgentPeer } from "../types";

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function mapAgent(
  a: Agent0RawAgent,
  provenance: {
    deploymentId: string;
    protocolSlug: string;
    network: string;
    schemaVersion?: string;
    blockNumber: number;
  },
): AgentPeer {
  const trust =
    a.trustScore == null ? undefined : Number(a.trustScore);
  return {
    ...provenance,
    id: a.id,
    name: a.name ?? undefined,
    description: a.description ?? undefined,
    mcpEndpoint: a.mcpEndpoint ?? undefined,
    a2aEndpoint: a.a2aEndpoint ?? undefined,
    trustScore: Number.isFinite(trust) ? trust : undefined,
    metadata: asRecord(a.metadata),
  };
}

export function normalizeAgent0(
  results: FanOutResult<Agent0RegistryData>[],
): AgentPeer[] {
  const rows: AgentPeer[] = [];
  for (const r of results) {
    const agents = r.data.agents ?? [];
    for (const a of agents) {
      rows.push(
        mapAgent(a, {
          deploymentId: r.deploymentId,
          protocolSlug: r.protocolSlug,
          network: r.network,
          schemaVersion: r.schemaVersion,
          blockNumber: r.blockNumber,
        }),
      );
    }
  }
  return rows;
}
