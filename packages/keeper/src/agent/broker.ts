import type { KeeperSecrets } from "../ring";
import type { Emit } from "./types";
import { toolsFor } from "./toolDefs";
import { runSpecialistLoop } from "./openrouter";
import type { ToolCtx } from "./tools";

const ALLOW_FULL = new Set([
  "proposeGuardianPolicy",
  "evaluateSwapGate",
  "requestExecutionAttempt",
  "getRecentPayments",
]);

const ALLOW_PROPOSE = new Set(["proposeGuardianPolicy", "getRecentPayments"]);

export async function runBroker(opts: {
  secrets: KeeperSecrets;
  userText: string;
  brief: string;
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
  proposeOnly?: boolean;
}): Promise<string> {
  const allow = opts.proposeOnly ? ALLOW_PROPOSE : ALLOW_FULL;
  const gateHint =
    opts.ctx.gateProceed === false
      ? "Gate proceed=false — do NOT call requestExecutionAttempt unless overrideExecute is true. Explain why and stop."
      : opts.ctx.gateProceed === true
        ? "Gate proceed=true. If user asked to execute, you MAY call requestExecutionAttempt. Otherwise summarize and stop."
        : "Gate unknown — call evaluateSwapGate once, then decide.";

  return runSpecialistLoop({
    secrets: opts.secrets,
    agent: "broker",
    model: opts.secrets.openRouterModels.broker,
    system: `You are LGA Execution Broker (Hedera x402 /trigger).
${gateHint}
overrideExecute=${opts.ctx.overrideExecute}
HARD RULES:
- Never ask the user for more information.
- Prefer getRecentPayments for status; proposeGuardianPolicy only if user wants a new policy.
- Never claim you signed on Ledger.
Master key never leaves Ledger; Key Ring holds keeper secrets.
${opts.brief ? `Coordinator note: ${opts.brief}` : ""}`,
    userContent: `${opts.userText}

Act with tools; do not ask clarifying questions.`,
    tools: toolsFor([...allow]),
    allow,
    ctx: opts.ctx,
    emit: opts.emit,
    runId: opts.runId,
    toolTrace: opts.toolTrace,
    forceToolsFirst: !opts.proposeOnly && opts.ctx.gateProceed == null,
  });
}
