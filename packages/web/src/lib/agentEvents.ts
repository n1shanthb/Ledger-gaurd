import { stripAgentJargon } from "@/lib/chatCopy";

export type AgentId =
  | "composer"
  | "autopilot"
  | "solver"
  | "payer"
  | "driver"
  | "clerk";

function softLast(raw: string, max = 90): string {
  const s = stripAgentJargon(raw)
    .replace(/pipeline=\w+/gi, "")
    .replace(/capability[^\s]*/gi, "")
    .replace(/cap_[a-z0-9-]+/gi, "")
    .replace(/subgraph\s*\d+/gi, "graph busy")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (/429|busy|rate limit/i.test(raw)) {
    return "Graph is busy — try again in a moment";
  }
  if (/paid \/trigger|payment only/i.test(s)) {
    return "Payment landed — still waiting on a fill";
  }
  if (/Driver ready|Fill only/i.test(s)) {
    return "Watching for a band hit on Base";
  }
  // Prefer the live sentence over robotic labels
  if (s.length > 8 && !/^code:/i.test(s)) return s.slice(0, max);
  return (s || "Working…").slice(0, max);
}

export type StrategyType = "STOP_LOSS" | "TAKE_PROFIT" | "BUY_DIP" | "LP_RANGE";

export type PolicyDraftItem = {
  strategyType: StrategyType;
  asset: string;
  amount: string;
  stopLossUsd?: number;
  takeProfitUsd?: number;
  maxSlippageBps?: number;
  reasoning: string;
};

export type PolicyDraft = {
  status: "need_input" | "ready";
  questions: string[];
  suggestions: string[];
  primary: PolicyDraftItem;
  addons?: PolicyDraftItem[];
};

export function draftIsReady(d: PolicyDraft): boolean {
  const p = d.primary;
  const amountOk = p.amount.trim().length > 0;
  const bandOk =
    p.strategyType === "BUY_DIP"
      ? p.takeProfitUsd != null || p.stopLossUsd != null
      : p.stopLossUsd != null || p.takeProfitUsd != null;
  return amountOk && bandOk;
}

export function withDraftStatus(d: PolicyDraft): PolicyDraft {
  const ready = draftIsReady(d);
  const questions = [...d.questions];
  if (!ready) {
    if (
      !d.primary.amount.trim() &&
      !questions.some((q) => /how much|amount|size/i.test(q))
    ) {
      questions.push("How much size should this policy cover?");
    }
    if (
      d.primary.stopLossUsd == null &&
      d.primary.takeProfitUsd == null &&
      !questions.some((q) => /band|price|trigger|stop|dip/i.test(q))
    ) {
      questions.push("What USD trigger band should we clear-sign?");
    }
  }
  return {
    ...d,
    status: ready ? "ready" : "need_input",
    questions: ready ? [] : questions,
  };
}

export type Evidence = {
  label: string;
  value: string;
  source: "pyth" | "messari" | "dex" | "gate";
};

export type AgentAction =
  | { type: "none" }
  | { type: "open_form"; payload: { kind: StrategyType; draft: PolicyDraft } }
  | {
      type: "patch_form";
      payload: { patch: Partial<PolicyDraftItem>; reason?: string };
    }
  | {
      /** Explain-advise: structured evidence, no CTA / no form open. */
      type: "show_evidence";
      payload: { evidence: Evidence[] };
    }
  | {
      type: "suggest_policy";
      payload: { draft: PolicyDraft; cta: string; evidence: Evidence[] };
    };

export type UiState = {
  formOpen: boolean;
  formKind: StrategyType | null;
  draft: PolicyDraftItem | null;
};

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
  | { type: "policy_draft"; runId: string; draft: PolicyDraft }
  | { type: "agent_end"; runId: string; agent: AgentId }
  | { type: "run_end"; runId: string; reply: string; action: AgentAction }
  | { type: "error"; runId: string; agent?: AgentId; message: string };

export type NodeState = "idle" | "active" | "tool" | "done" | "error";

export type GraphNode = {
  state: NodeState;
  model?: string;
  last?: string;
  activeTool?: string;
};

export type GraphState = {
  nodes: Record<AgentId, GraphNode>;
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
  /** Telemetry / 3D only — not the live form source of truth. */
  policyDraft: PolicyDraft | null;
  action: AgentAction;
};

const AGENTS: AgentId[] = [
  "composer",
  "autopilot",
  "solver",
  "payer",
  "driver",
  "clerk",
];

export function emptyGraph(): GraphState {
  return {
    nodes: {
      composer: { state: "idle" },
      autopilot: { state: "idle" },
      solver: { state: "idle" },
      payer: { state: "idle" },
      driver: { state: "idle" },
      clerk: { state: "idle" },
    },
    edges: [],
    log: [],
    reply: "",
    runId: null,
    gate: null,
    policyDraft: null,
    action: { type: "none" },
  };
}

/** Soft reset nodes/edges for a new run but keep draft + log. */
export function softResetGraph(prev: GraphState, runId: string): GraphState {
  const base = emptyGraph();
  return {
    ...base,
    runId,
    policyDraft: prev.policyDraft,
    action: prev.action,
    log: [...prev.log, { t: Date.now(), line: `run ${runId}` }].slice(-80),
    reply: prev.reply,
  };
}

export function reduceEvent(prev: GraphState, ev: AgentEvent): GraphState {
  const next: GraphState = {
    ...prev,
    nodes: { ...prev.nodes },
    edges: prev.edges.map((e) => ({ ...e })),
    log: [...prev.log],
    policyDraft: prev.policyDraft,
    action: prev.action,
  };

  const push = (line: string) => {
    next.log = [...next.log, { t: Date.now(), line }].slice(-80);
  };

  switch (ev.type) {
    case "run_start":
      return softResetGraph(prev, ev.runId);
    case "agent_start":
      next.nodes[ev.agent] = {
        state: "active",
        model: ev.model,
        last: prev.nodes[ev.agent]?.last,
        activeTool: undefined,
      };
      push(`${ev.agent} · ${ev.model}`);
      break;
    case "agent_message": {
      const soft = softLast(ev.text);
      next.nodes[ev.agent] = {
        ...next.nodes[ev.agent],
        state: next.nodes[ev.agent].state === "tool" ? "tool" : "active",
        last: soft,
      };
      push(`${ev.agent}: ${soft}`);
      break;
    }
    case "tool_start":
      next.nodes[ev.agent] = {
        ...next.nodes[ev.agent],
        state: "tool",
        last: ev.tool,
        activeTool: ev.tool,
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
        last: softLast(ev.summary ?? ev.tool),
        activeTool: undefined,
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
    case "policy_draft":
      next.policyDraft = ev.draft;
      push(
        `policy_draft ${ev.draft.status} · ${ev.draft.primary.strategyType} ${ev.draft.primary.asset}`,
      );
      break;
    case "agent_end":
      next.nodes[ev.agent] = {
        ...next.nodes[ev.agent],
        state: "done",
        activeTool: undefined,
      };
      next.edges = next.edges.map((e) =>
        e.to === ev.agent ? { ...e, live: false } : e,
      );
      break;
    case "run_end":
      next.reply = ev.reply;
      next.action = ev.action ?? { type: "none" };
      for (const a of AGENTS) {
        if (next.nodes[a].state === "active" || next.nodes[a].state === "tool") {
          next.nodes[a] = {
            ...next.nodes[a],
            state: "done",
            activeTool: undefined,
          };
        }
      }
      next.edges = next.edges.map((e) => ({ ...e, live: false }));
      push(
        next.action.type === "none"
          ? "run end"
          : `run end · action=${next.action.type}`,
      );
      break;
    case "error":
      if (ev.agent) {
        next.nodes[ev.agent] = {
          ...next.nodes[ev.agent],
          state: "error",
          last: ev.message,
          activeTool: undefined,
        };
      }
      push(`error: ${ev.message}`);
      break;
  }
  return next;
}
