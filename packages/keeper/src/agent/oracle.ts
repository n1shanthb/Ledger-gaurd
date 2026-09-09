import type { KeeperSecrets } from "../ring";
import type { Emit } from "./types";
import { toolsFor } from "./toolDefs";
import { runSpecialistLoop } from "./openrouter";
import type { ToolCtx } from "./tools";

const ALLOW = new Set([
  "getPythSpot",
  "compareLendingRisk",
  "findDeepestWethPool",
  "evaluateSwapGate",
]);

export async function runOracle(opts: {
  secrets: KeeperSecrets;
  userText: string;
  brief: string;
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
}): Promise<string> {
  return runSpecialistLoop({
    secrets: opts.secrets,
    agent: "oracle",
    model: opts.secrets.openRouterModels.oracle,
    system: `You are LGA Market Oracle. You ONLY use Pyth + Messari decide tools.
HARD RULES:
- Never ask the user for more information. Use defaults: ETH spot, USDC borrow, snappy Messari.
- On EVERY turn that needs a risk call: call getPythSpot(eth) AND evaluateSwapGate (and optionally compareLendingRisk / findDeepestWethPool).
- After tools return, give a short verdict (proceed or not) in plain English.
- Never execute x402. Never claim Ledger signed.
Master key never leaves Ledger; Key Ring holds keeper secrets.
${opts.brief ? `Coordinator note: ${opts.brief}` : ""}`,
    userContent: `${opts.userText}

Call tools now with defaults. Do not ask clarifying questions.`,
    tools: toolsFor([...ALLOW]),
    allow: ALLOW,
    ctx: opts.ctx,
    emit: opts.emit,
    runId: opts.runId,
    toolTrace: opts.toolTrace,
    forceToolsFirst: true,
  });
}
