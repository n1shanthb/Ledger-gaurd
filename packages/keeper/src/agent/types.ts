export type AgentId = "coordinator" | "sentinel" | "oracle" | "broker";

export type Pipeline =
  | "status"
  | "risk"
  | "execute"
  | "propose"
  | "full";

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

export type Emit = (ev: AgentEvent) => void;

export type OpenRouterModels = {
  coordinator: string;
  sentinel: string;
  oracle: string;
  broker: string;
};

export type RunResult = {
  reply: string;
  toolTrace: string[];
  runId: string;
  pipeline: Pipeline;
  agents: { agent: AgentId; model: string }[];
  gateProceed: boolean | null;
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
