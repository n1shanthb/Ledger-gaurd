export type AgentId = "coordinator" | "sentinel" | "oracle" | "broker";

export type AgentEvent =
  | { type: "run_start"; runId: string }
  | { type: "agent_start"; runId: string; agent: AgentId; model: string }
  | { type: "agent_message"; runId: string; agent: AgentId; text: string }
  | { type: "tool_start"; runId: string; agent: AgentId; tool: string }
  | {
      type: "tool_end";
      runId: string;
      agent: AgentId;
      tool: string;
      ok: boolean;
      summary?: string;
    }
  | {
      type: "edge";
      runId: string;
      from: AgentId;
      to: AgentId;
      label: string;
    }
  | { type: "gate"; runId: string; proceed: boolean; reasons: string[] }
  | { type: "agent_end"; runId: string; agent: AgentId }
  | { type: "run_end"; runId: string; reply: string }
  | { type: "error"; runId: string; agent?: AgentId; message: string };

export type NodeState = "idle" | "active" | "tool" | "done" | "error";

export type GraphState = {
  nodes: Record<AgentId, { state: NodeState; model?: string; last?: string }>;
  edges: {
    from: AgentId;
    to: AgentId;
    label: string;
    live: boolean;
  }[];
  log: { t: number; line: string }[];
  reply: string;
  runId: string | null;
  gate: { proceed: boolean; reasons: string[] } | null;
};

const AGENTS: AgentId[] = ["coordinator", "sentinel", "oracle", "broker"];

export function emptyGraph(): GraphState {
  return {
    nodes: {
      coordinator: { state: "idle" },
      sentinel: { state: "idle" },
      oracle: { state: "idle" },
      broker: { state: "idle" },
    },
    edges: [],
    log: [],
    reply: "",
    runId: null,
    gate: null,
  };
}

export function reduceEvent(prev: GraphState, ev: AgentEvent): GraphState {
  const next: GraphState = {
    ...prev,
    nodes: { ...prev.nodes },
    edges: prev.edges.map((e) => ({ ...e })),
    log: [...prev.log],
  };

  const push = (line: string) => {
    next.log = [...next.log, { t: Date.now(), line }].slice(-80);
  };

  switch (ev.type) {
    case "run_start":
      return {
        ...emptyGraph(),
        runId: ev.runId,
        log: [{ t: Date.now(), line: `run ${ev.runId}` }],
      };
    case "agent_start":
      next.nodes[ev.agent] = {
        state: "active",
        model: ev.model,
        last: prev.nodes[ev.agent]?.last,
      };
      push(`${ev.agent} · ${ev.model}`);
      break;
    case "agent_message":
      next.nodes[ev.agent] = {
        ...next.nodes[ev.agent],
        state: next.nodes[ev.agent].state === "tool" ? "tool" : "active",
        last: ev.text.slice(0, 120),
      };
      push(`${ev.agent}: ${ev.text.slice(0, 100)}`);
      break;
    case "tool_start":
      next.nodes[ev.agent] = {
        ...next.nodes[ev.agent],
        state: "tool",
        last: ev.tool,
      };
      next.edges = next.edges.map((e) =>
        e.to === ev.agent || e.from === ev.agent
          ? { ...e, live: true, label: ev.tool }
          : e,
      );
      push(`${ev.agent} → ${ev.tool}`);
      break;
    case "tool_end":
      next.nodes[ev.agent] = {
        ...next.nodes[ev.agent],
        state: "active",
        last: ev.summary ?? ev.tool,
      };
      next.edges = next.edges.map((e) =>
        e.label === ev.tool ? { ...e, live: false } : e,
      );
      push(
        `${ev.agent} · ${ev.tool} ${ev.ok ? "ok" : "fail"}${ev.summary ? ` · ${ev.summary}` : ""}`,
      );
      break;
    case "edge":
      next.edges = [
        ...next.edges.filter((e) => !(e.from === ev.from && e.to === ev.to)),
        { from: ev.from, to: ev.to, label: ev.label, live: true },
      ];
      push(`edge ${ev.from}→${ev.to} · ${ev.label}`);
      break;
    case "gate":
      next.gate = { proceed: ev.proceed, reasons: ev.reasons };
      push(`gate ${ev.proceed ? "clear" : "warn"}`);
      break;
    case "agent_end":
      next.nodes[ev.agent] = {
        ...next.nodes[ev.agent],
        state: "done",
      };
      next.edges = next.edges.map((e) =>
        e.to === ev.agent ? { ...e, live: false } : e,
      );
      break;
    case "run_end":
      next.reply = ev.reply;
      for (const a of AGENTS) {
        if (next.nodes[a].state === "active" || next.nodes[a].state === "tool") {
          next.nodes[a] = { ...next.nodes[a], state: "done" };
        }
      }
      next.edges = next.edges.map((e) => ({ ...e, live: false }));
      push("run end");
      break;
    case "error":
      if (ev.agent) {
        next.nodes[ev.agent] = {
          ...next.nodes[ev.agent],
          state: "error",
          last: ev.message,
        };
      }
      push(`error: ${ev.message}`);
      break;
  }
  return next;
}
