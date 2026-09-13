import type { AgentId, GraphState, NodeState } from "@/lib/agentEvents";

export type ExternalId = "graph" | "messari" | "hedera" | "ledger";

export type SceneAgent = {
  id: AgentId;
  title: string;
  role: string;
  accent: "graph" | "oracle" | "broker" | "hub" | "autopilot" | "driver";
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

const ROLE: Record<
  AgentId,
  { title: string; role: string; accent: SceneAgent["accent"] }
> = {
  composer: {
    title: "Composer",
    role: "Router",
    accent: "hub",
  },
  clerk: {
    title: "Clerk",
    role: "Receipt Graph",
    accent: "graph",
  },
  solver: {
    title: "Market Solver",
    role: "Messari · risk",
    accent: "oracle",
  },
  payer: {
    title: "Payer",
    role: "x402",
    accent: "broker",
  },
  autopilot: {
    title: "Autopilot",
    role: "Graph · watch",
    accent: "autopilot",
  },
  driver: {
    title: "Driver",
    role: "Base fill",
    accent: "driver",
  },
};

const IDLE_BADGE: Record<AgentId, string> = {
  composer: "AWAITING PIPELINE",
  clerk: "STANDBY · RECEIPT GRAPH",
  solver: "STANDBY · MESSARI",
  payer: "STANDBY · x402",
  autopilot: "STANDBY · PAY-ON-HIT",
  driver: "STANDBY · BASE FILL",
};

function badgeFor(
  id: AgentId,
  state: NodeState,
  tool?: string,
  last?: string,
): string {
  if (state === "error") return "ERROR";
  if (state === "done") return "COMPLETE";
  if (tool) {
    const t = tool.toLowerCase();
    if (
      t.includes("propose") ||
      t.includes("hitl") ||
      t.includes("clear") ||
      t.includes("sign")
    ) {
      return "AWAITING LEDGER HITL CLEAR-SIGN";
    }
    if (
      t.includes("listactive") ||
      t.includes("subgraph") ||
      t.includes("mcp") ||
      t.includes("payment")
    ) {
      return "READING LGA SUBGRAPH";
    }
    if (t.includes("policy") && !t.includes("propose")) {
      return "READING LGA SUBGRAPH";
    }
    if (
      t.includes("swapgate") ||
      t.includes("decide") ||
      t.includes("borrow") ||
      t.includes("pool")
    ) {
      return "EVALUATING CROSS PROTOCOL RISK";
    }
    if (t.includes("pyth") || t.includes("price")) {
      return "QUERYING PYTH ORACLE";
    }
    if (
      t.includes("execut") ||
      t.includes("x402") ||
      t.includes("trigger") ||
      t.includes("postpaid")
    ) {
      return "PREPARING HEDERA x402 PAYMENT";
    }
    return `CALLING · ${tool}`;
  }
  if (state === "active" || state === "tool") {
    if (id === "composer") return "ROUTING AGENTS";
    if (id === "payer") return "x402 · PAID TRIGGER";
    if (id === "autopilot") return "WATCHING BANDS";
    if (id === "driver") return "BASE EXECUTE";
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
    t.includes("pay") ||
    t.includes("postpaid")
  ) {
    return "hedera";
  }
  return null;
}

const AGENT_EXTERNAL: Partial<Record<AgentId, ExternalId>> = {
  clerk: "graph",
  solver: "messari",
  payer: "hedera",
  driver: "hedera",
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

  const composer = graph.nodes.composer;
  const composerTool = (composer.activeTool ?? composer.last ?? "").toLowerCase();
  const ledgerHitl =
    externalLive.has("ledger") ||
    (composer.state === "tool" &&
      (composerTool.includes("propose") ||
        composerTool.includes("hitl") ||
        composerTool.includes("sign"))) ||
    (composer.state === "active" &&
      (composerTool.includes("propose") || composerTool.includes("hitl")));

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
      label: "The Graph",
      caption: "Receipt Graph · policies & audits",
      live: externalLive.has("graph"),
    },
    {
      id: "messari",
      label: "Messari Gateway",
      caption: "Lending / DEX standards",
      live: externalLive.has("messari"),
    },
    {
      id: "hedera",
      label: "Hedera",
      caption: "x402 pay · HCS audit",
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
      edgeLive.get(`composer-${to}`) ?? edgeLive.get(`${to}-composer`);
    const agentHot =
      graph.nodes[to].state === "active" || graph.nodes[to].state === "tool";
    const hubHot =
      graph.nodes.composer.state === "active" ||
      graph.nodes.composer.state === "tool";
    return {
      live: Boolean(hit?.live) || (agentHot && hubHot) || agentHot,
      label: hit?.label,
    };
  };

  const peerLive = (a: AgentId, b: AgentId) => {
    const hit = edgeLive.get(`${a}-${b}`) ?? edgeLive.get(`${b}-${a}`);
    return { live: Boolean(hit?.live), label: hit?.label };
  };

  const edges: SceneEdge[] = [
    {
      key: "orch-clerk",
      from: "composer",
      to: "clerk",
      kind: "orch",
      ...orchLive("clerk"),
    },
    {
      key: "orch-solver",
      from: "composer",
      to: "solver",
      kind: "orch",
      ...orchLive("solver"),
    },
    {
      key: "orch-payer",
      from: "composer",
      to: "payer",
      kind: "orch",
      ...orchLive("payer"),
    },
    {
      key: "orch-autopilot",
      from: "composer",
      to: "autopilot",
      kind: "orch",
      ...orchLive("autopilot"),
    },
    {
      key: "orch-driver",
      from: "composer",
      to: "driver",
      kind: "orch",
      ...orchLive("driver"),
    },
    {
      key: "clerk-solver",
      from: "clerk",
      to: "solver",
      kind: "peer",
      ...peerLive("clerk", "solver"),
    },
    {
      key: "solver-payer",
      from: "solver",
      to: "payer",
      kind: "peer",
      ...peerLive("solver", "payer"),
    },
    {
      key: "autopilot-payer",
      from: "autopilot",
      to: "payer",
      kind: "peer",
      ...peerLive("autopilot", "payer"),
    },
    {
      key: "payer-driver",
      from: "payer",
      to: "driver",
      kind: "peer",
      ...peerLive("payer", "driver"),
    },
    {
      key: "ext-graph",
      from: "graph",
      to: "clerk",
      kind: "external",
      live: externalLive.has("graph"),
      label: externalLive.has("graph") ? "subgraph" : undefined,
    },
    {
      key: "ext-messari",
      from: "messari",
      to: "solver",
      kind: "external",
      live: externalLive.has("messari"),
      label: externalLive.has("messari") ? "metrics" : undefined,
    },
    {
      key: "ext-hedera",
      from: "payer",
      to: "hedera",
      kind: "external",
      live: externalLive.has("hedera"),
      label: externalLive.has("hedera") ? "x402" : undefined,
    },
    {
      key: "ext-ledger",
      from: "composer",
      to: "ledger",
      kind: "external",
      live: externalLive.has("ledger"),
      label: externalLive.has("ledger") ? "HITL clear-sign" : undefined,
    },
    {
      key: "orch-ledger",
      from: "composer",
      to: "ledger",
      kind: "external",
      live: externalLive.has("ledger"),
      label: externalLive.has("ledger") ? "policy bounds" : undefined,
    },
  ];

  return { agents, externals, edges, gate: graph.gate };
}
