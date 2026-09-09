import type { KeeperSecrets } from "../ring";
import type { Emit, Pipeline } from "./types";
import { openRouterJson } from "./openrouter";

const PIPELINES = new Set<Pipeline>([
  "status",
  "risk",
  "execute",
  "propose",
  "full",
]);

export type CoordResult = {
  pipeline: Pipeline;
  overrideExecute: boolean;
  note: string;
};

function parseCoord(raw: string): CoordResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const slice =
    start >= 0 && end > start ? raw.slice(start, end + 1) : raw.trim();
  try {
    const j = JSON.parse(slice) as {
      pipeline?: string;
      overrideExecute?: boolean;
      note?: string;
    };
    const pipeline = PIPELINES.has(j.pipeline as Pipeline)
      ? (j.pipeline as Pipeline)
      : "full";
    return {
      pipeline,
      overrideExecute: Boolean(j.overrideExecute),
      note: typeof j.note === "string" ? j.note : "",
    };
  } catch {
    return { pipeline: "full", overrideExecute: false, note: "parse fallback" };
  }
}

export async function runCoordinator(opts: {
  secrets: KeeperSecrets;
  userText: string;
  emit: Emit;
  runId: string;
}): Promise<CoordResult> {
  const model = opts.secrets.openRouterModels.coordinator;
  opts.emit({
    type: "agent_start",
    runId: opts.runId,
    agent: "coordinator",
    model,
  });

  const system = `You are LGA Coordinator. Classify the user message into ONE pipeline.
Reply with ONLY JSON: {"pipeline":"status"|"risk"|"execute"|"propose"|"full","overrideExecute":boolean,"note":"short"}
Rules:
- status: policies / receipts / what's active
- risk: borrow risk, WETH depth, should I swap, gate, Messari
- execute: run trigger / pay x402 / fill now
- propose: draft a Guardian policy for Ledger clear-sign
- full: vague "what should we do" / mix of status+risk+action
- overrideExecute=true ONLY if user explicitly says override / force / ignore gate
Master key never leaves Ledger; Key Ring holds keeper secrets.`;

  const raw = await openRouterJson({
    apiKey: opts.secrets.openRouterApiKey,
    model,
    system,
    user: opts.userText,
  });
  const result = parseCoord(raw);
  opts.emit({
    type: "agent_message",
    runId: opts.runId,
    agent: "coordinator",
    text: `pipeline=${result.pipeline}${result.overrideExecute ? " override" : ""} ${result.note}`.trim(),
  });
  opts.emit({ type: "agent_end", runId: opts.runId, agent: "coordinator" });
  return result;
}
