import type { AgentId, GraphState, NodeState } from "@/lib/agentEvents";

export type ExternalId = "graph" | "messari" | "hedera" | "ledger";


export type SceneAgent = {
  id: AgentId;
  title: string;
  role: string;
  accent: "graph" | "oracle" | "broker" | "hub";
  state: NodeState;
  model?: string;
  activeTool?: string;
  last?: string;
  badge: string;
  hot: boolean;
};

export type SceneExternal = {
  id: ExternalId;
  label: string;
  caption: string;
  live: boolean;
};

export type SceneEdge = {
  key: string;
  from: AgentId | ExternalId;
  to: AgentId | ExternalId;
  live: boolean;
  label?: string;
  kind: "orch" | "peer" | "external";
};

export type AgentScene = {
  agents: SceneAgent[];
  externals: SceneExternal[];
  edges: SceneEdge[];
  gate: GraphState["gate"];
};

const ROLE: Record<AgentId, { title: string; role: string; accent: SceneAgent["accent"] }> = {
  coordinator: {
    title: "Orchestrator",
    role: "Router",
    accent: "hub",
  },
  sentinel: {
    title: "Data Explorer",
    role: "Sentinel",
    accent: "graph",
  },
  oracle: {
    title: "Risk Analyst",
    role: "Oracle",
    accent: "oracle",
  },
  broker: {
    title: "Execution Agent",
    role: "Broker",
    accent: "broker",
  },
};

const IDLE_BADGE: Record<AgentId, string> = {
  coordinator: "AWAITING PIPELINE",
  sentinel: "STANDBY · POLICIES",
  oracle: "STANDBY · RISK",
  broker: "STANDBY · x402",
};

function badgeFor(id: AgentId, state: NodeState, tool?: string, last?: string): string {
  if (state === "error") return "ERROR";
  if (state === "done") return "COMPLETE";
  if (tool) {
    const t = tool.toLowerCase();
    if (t.includes("propose") || t.includes("hitl") || t.includes("clear") || t.includes("sign")) {
      return "AWAITING LEDGER HITL CLEAR-SIGN";
    }
    if (t.includes("listactive") || t.includes("subgraph") || t.includes("mcp")) {
      return "READING LGA SUBGRAPH";
    }
    if (t.includes("policy") && !t.includes("propose")) {
      return "READING LGA SUBGRAPH";
    }
    if (t.includes("swapgate") || t.includes("decide") || t.includes("borrow") || t.includes("pool")) {
      return "EVALUATING CROSS PROTOCOL RISK";
    }
    if (t.includes("pyth") || t.includes("price")) {
      return "QUERYING PYTH ORACLE";
    }
    if (t.includes("execut") || t.includes("x402") || t.includes("payment") || t.includes("trigger")) {
      return "PREPARING HEDERA x402 PAYMENT";
    }
    return `CALLING · ${tool}`;
  }
  if (state === "active" || state === "tool") {
    if (id === "coordinator") return "ROUTING AGENTS";
    if (id === "broker") return "HITL · LEDGER OR x402";
    if (last) return last.slice(0, 42).toUpperCase();
    return "THINKING";
  }
  return IDLE_BADGE[id];
}

function externalForTool(tool: string): ExternalId | null {
  const t = tool.toLowerCase();
  if (
    t.includes("propose") ||
    t.includes("hitl") ||
    t.includes("clear-sign") ||
    t.includes("clearsign") ||
    t.includes("ledger") ||
    (t.includes("sign") && t.includes("policy"))
  ) {
    return "ledger";
  }
  if (
    t.includes("listactive") ||
    t.includes("subgraph") ||
    t.includes("mcp") ||
    (t.includes("policy") && !t.includes("propose"))
  ) {
    return "graph";
  }
  if (
    t.includes("swapgate") ||
    t.includes("decide") ||
    t.includes("borrow") ||
    t.includes("pool") ||
    t.includes("messari") ||
    t.includes("pyth") ||
    t.includes("price")
  ) {
    return "messari";
  }
  if (
    t.includes("execut") ||
    t.includes("x402") ||
    t.includes("payment") ||
    t.includes("trigger") ||
    t.includes("pay")
  ) {
    return "hedera";
  }
  return null;
}

const AGENT_EXTERNAL: Partial<Record<AgentId, ExternalId>> = {
  sentinel: "graph",
  oracle: "messari",
  broker: "hedera",
};

export function deriveScene(graph: GraphState): AgentScene {
  const liveTools = (Object.keys(graph.nodes) as AgentId[])
    .map((id) => ({ id, tool: graph.nodes[id].activeTool }))
    .filter((x): x is { id: AgentId; tool: string } => Boolean(x.tool));

  const externalLive = new Set<ExternalId>();
  for (const { id, tool } of liveTools) {
    const ext = externalForTool(tool) ?? AGENT_EXTERNAL[id];
    if (ext) externalLive.add(ext);
  }

  // Pulse Ledger HITL when broker is working on propose / gate-clear path
  const broker = graph.nodes.broker;
  const brokerTool = (broker.activeTool ?? broker.last ?? "").toLowerCase();
  const ledgerHitl =
    externalLive.has("ledger") ||
    (broker.state === "tool" &&
      (brokerTool.includes("propose") ||
        brokerTool.includes("hitl") ||
        brokerTool.includes("sign"))) ||
    (broker.state === "active" &&
      (brokerTool.includes("propose") || brokerTool.includes("hitl")));

  if (ledgerHitl) externalLive.add("ledger");

  const agents: SceneAgent[] = (Object.keys(ROLE) as AgentId[]).map((id) => {
    const n = graph.nodes[id];
    const hot = n.state === "active" || n.state === "tool";
    return {
      id,
      ...ROLE[id],
      state: n.state,
      model: n.model,
      activeTool: n.activeTool,
      last: n.last,
      badge: badgeFor(id, n.state, n.activeTool, n.last),
      hot,
    };
  });

  const externals: SceneExternal[] = [
    {
      id: "graph",
      label: "The Graph Studio",
      caption: "LGA Receipt Graph",
      live: externalLive.has("graph"),
    },
    {
      id: "messari",
      label: "Messari Gateway",
      caption: "Standard DEX / Lending",
      live: externalLive.has("messari"),
    },
    {
      id: "hedera",
      label: "Hedera HCS",
      caption: "x402 execution",
      live: externalLive.has("hedera"),
    },
    {
      id: "ledger",
      label: "Ledger Device",
      caption: ledgerHitl
        ? "HITL · confirm on OLED"
        : "Master key never leaves Ledger",
      live: externalLive.has("ledger"),
    },
  ];

  const edgeLive = new Map<string, { live: boolean; label?: string }>();
  for (const e of graph.edges) {
    edgeLive.set(`${e.from}-${e.to}`, { live: e.live, label: e.label });
    edgeLive.set(`${e.to}-${e.from}`, { live: e.live, label: e.label });
  }

  const orchLive = (to: AgentId) => {
    const hit =
      edgeLive.get(`coordinator-${to}`) ?? edgeLive.get(`${to}-coordinator`);
    const agentHot = graph.nodes[to].state === "active" || graph.nodes[to].state === "tool";
    const coordHot =
      graph.nodes.coordinator.state === "active" ||
      graph.nodes.coordinator.state === "tool";
    return {
      live: Boolean(hit?.live) || (agentHot && coordHot) || agentHot,
      label: hit?.label,
    };
  };

  const peerLive = (a: AgentId, b: AgentId) => {
    const hit = edgeLive.get(`${a}-${b}`) ?? edgeLive.get(`${b}-${a}`);
    return { live: Boolean(hit?.live), label: hit?.label };
  };

  const edges: SceneEdge[] = [
    {
      key: "orch-sentinel",
      from: "coordinator",
      to: "sentinel",
      kind: "orch",
      ...orchLive("sentinel"),
    },
    {
      key: "orch-oracle",
      from: "coordinator",
      to: "oracle",
      kind: "orch",
      ...orchLive("oracle"),
    },
    {
      key: "orch-broker",
      from: "coordinator",
      to: "broker",
      kind: "orch",
      ...orchLive("broker"),
    },
    {
      key: "sentinel-oracle",
      from: "sentinel",
      to: "oracle",
      kind: "peer",
      ...peerLive("sentinel", "oracle"),
    },
    {
      key: "oracle-broker",
      from: "oracle",
      to: "broker",
      kind: "peer",
      ...peerLive("oracle", "broker"),
    },
    {
      key: "ext-graph",
      from: "graph",
      to: "sentinel",
      kind: "external",
      live: externalLive.has("graph"),
      label: externalLive.has("graph") ? "subgraph" : undefined,
    },
    {
      key: "ext-messari",
      from: "messari",
      to: "oracle",
      kind: "external",
      live: externalLive.has("messari"),
      label: externalLive.has("messari") ? "metrics" : undefined,
    },
    {
      key: "ext-hedera",
      from: "broker",
      to: "hedera",
      kind: "external",
      live: externalLive.has("hedera"),
      label: externalLive.has("hedera") ? "x402" : undefined,
    },
    {
      key: "ext-ledger",
      from: "broker",
      to: "ledger",
      kind: "external",
      live: externalLive.has("ledger"),
      label: externalLive.has("ledger") ? "HITL clear-sign" : undefined,
    },
    {
      key: "orch-ledger",
      from: "coordinator",
      to: "ledger",
      kind: "external",
      live: externalLive.has("ledger"),
      label: externalLive.has("ledger") ? "policy bounds" : undefined,
    },
  ];

  return { agents, externals, edges, gate: graph.gate };
}
