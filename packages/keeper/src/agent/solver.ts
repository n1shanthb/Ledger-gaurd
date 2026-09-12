import type { KeeperSecrets } from "../ring";
import type { Emit } from "./types";
import { toolsFor } from "./toolDefs";
import { runSpecialistLoop } from "./openrouter";
import type { ToolCtx } from "./tools";

/** Explain-only tools — gate already ran in-process via ensureSolverGate. */
const ALLOW = new Set([
  "getPythSpot",
  "compareLendingRisk",
  "findDeepestWethPool",
]);

export async function runSolver(opts: {
  secrets: KeeperSecrets;
  userText: string;
  brief: string;
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
}): Promise<string> {
  const gateHint =
    opts.ctx.gateProceed == null
      ? "Gate not set."
      : opts.ctx.gateProceed
        ? "Gate proceed=true (code-first evaluateSwapGate already ran)."
        : "Gate proceed=false (code-first evaluateSwapGate already ran).";

  return runSpecialistLoop({
    secrets: opts.secrets,
    agent: "solver",
    model: opts.secrets.openRouterModels.solver,
    system: `You are LGA Market Solver. Explain risk using Pyth + Messari decide tools.
${gateHint}
HARD RULES:
- evaluateSwapGate already ran in-process — do NOT call it again.
- Never ask the user for more information. Defaults: ETH spot, USDC borrow.
- Short plain-English verdict. Never execute x402. Never claim Ledger signed.
Master key never leaves Ledger; Key Ring holds keeper secrets.
${opts.brief ? `Composer note: ${opts.brief}` : ""}`,
    userContent: `${opts.userText}

Explain the risk picture. Optional tools: getPythSpot, compareLendingRisk, findDeepestWethPool.`,
    tools: toolsFor([...ALLOW]),
    allow: ALLOW,
    ctx: opts.ctx,
    emit: opts.emit,
    runId: opts.runId,
    toolTrace: opts.toolTrace,
    // no forceToolsFirst — avoids Sonnet tool_choice=required stalls
    forceToolsFirst: false,
  });
}
