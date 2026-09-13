export type AgentId =
  | "composer"
  | "autopilot"
  | "solver"
  | "payer"
  | "driver"
  | "clerk";

export type Pipeline =
  | "status"
  | "advise"
  | "propose"
  | "modify"
  | "execute"
  | "full";

export type { PolicyDraft, PolicyDraftItem, StrategyType } from "./policyDraft";
import type {
  PolicyDraft,
  PolicyDraftItem,
  StrategyType,
} from "./policyDraft";

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
  action: AgentAction;
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
