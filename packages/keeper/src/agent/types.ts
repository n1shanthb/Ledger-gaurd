export type AgentId =
  | "composer"
  | "autopilot"
  | "solver"
  | "payer"
  | "driver"
  | "clerk";

export type Pipeline =
  | "status"
  | "risk"
  | "execute"
  | "propose"
  | "full";

export type { PolicyDraft, PolicyDraftItem, StrategyType } from "./policyDraft";
import type { PolicyDraft } from "./policyDraft";

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
  | { type: "run_end"; runId: string; reply: string }
  | { type: "error"; runId: string; agent?: AgentId; message: string };

export type Emit = (ev: AgentEvent) => void;

/** LLM-backed roles only — autopilot / payer / driver are code paths. */
export type OpenRouterModels = {
  composer: string;
  solver: string;
  clerk: string;
};

export type RunResult = {
  reply: string;
  toolTrace: string[];
  runId: string;
  pipeline: Pipeline;
  agents: { agent: AgentId; model: string }[];
  gateProceed: boolean | null;
  policyDraft?: PolicyDraft | null;
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
