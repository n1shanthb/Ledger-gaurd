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

export type ComposerResult = {
  pipeline: Pipeline;
  overrideExecute: boolean;
  note: string;
};

function parseComposer(raw: string): ComposerResult {
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

/** Prior intake left questions open — short replies like "2 eth" stay on propose. */
export function stickyPropose(
  messages: { role: "user" | "assistant"; content: string }[],
): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return false;

  const lastAsst = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  if (!lastAsst) return false;

  const open =
    /Policy intake/i.test(lastAsst.content) ||
    /Draft need_input/i.test(lastAsst.content) ||
    /\n\? /m.test(lastAsst.content);
  if (!open) return false;

  // User switched away from intake → let classifier pick.
  if (
    /\b(risk|messari|borrow|depth|trigger|pay|x402|receipt|status|policies|gate)\b/i.test(
      last.content,
    ) &&
    !/\b(stop|protect|amount|slip|bps|eth|weth|dip|\$|\d)/i.test(last.content)
  ) {
    return false;
  }

  return true;
}

export async function runComposer(opts: {
  secrets: KeeperSecrets;
  userText: string;
  userMessages?: { role: "user" | "assistant"; content: string }[];
  forcePropose?: boolean;
  emit: Emit;
  runId: string;
}): Promise<ComposerResult> {
  const model = opts.secrets.openRouterModels.composer;
  opts.emit({
    type: "agent_start",
    runId: opts.runId,
    agent: "composer",
    model,
  });

  if (opts.forcePropose) {
    const result: ComposerResult = {
      pipeline: "propose",
      overrideExecute: false,
      note: "sticky intake follow-up",
    };
    opts.emit({
      type: "agent_message",
      runId: opts.runId,
      agent: "composer",
      text: `pipeline=${result.pipeline} ${result.note}`,
    });
    opts.emit({ type: "agent_end", runId: opts.runId, agent: "composer" });
    return result;
  }

  const history =
    opts.userMessages && opts.userMessages.length > 1
      ? opts.userMessages
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")
          .slice(-4000)
      : opts.userText;

  const system = `You are LGA Composer. Classify the user message into ONE pipeline.
Reply with ONLY JSON: {"pipeline":"status"|"risk"|"execute"|"propose"|"full","overrideExecute":boolean,"note":"short"}
Rules:
- status: policies / receipts / what's active / recent payments
- risk: borrow risk, WETH depth, should I swap, gate, Messari — analysis only, no new policy
- execute: run trigger / pay x402 / fill now
- propose: set / draft / protect / stop-loss / take-profit / buy-dip / exit bounds / clear-sign a Guardian policy (HITL intake)
- full: vague mix of status+risk+action without clear policy intent
- overrideExecute=true ONLY if user explicitly says override / force / ignore gate
Protect / "keep me safe if it dumps" / "set a stop" → propose (not risk).
If conversation shows an open policy intake (questions / need_input) and the latest user message answers size, band, or slippage → propose.
Master key never leaves Ledger; Key Ring holds keeper secrets.`;

  const raw = await openRouterJson({
    apiKey: opts.secrets.openRouterApiKey,
    model,
    system,
    user: history,
  });
  const result = parseComposer(raw);
  opts.emit({
    type: "agent_message",
    runId: opts.runId,
    agent: "composer",
    text: `pipeline=${result.pipeline}${result.overrideExecute ? " override" : ""} ${result.note}`.trim(),
  });
  opts.emit({ type: "agent_end", runId: opts.runId, agent: "composer" });
  return result;
}
