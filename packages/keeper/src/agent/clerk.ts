import type { KeeperSecrets } from "../ring";
import type { Emit } from "./types";
import { toolsFor } from "./toolDefs";
import { runSpecialistLoop } from "./openrouter";
import type { ToolCtx } from "./tools";

const ALLOW = new Set(["listActivePolicies", "getRecentPayments"]);

export async function runClerk(opts: {
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
    agent: "clerk",
    model: opts.secrets.openRouterModels.clerk,
    system: `You are LGA Clerk. Status only — Receipt Graph policies + recent x402 payments.
Always call listActivePolicies. Call getRecentPayments when useful.
Zero policies is valid — say so and stop.
Never invent prices or TVL. Never claim you signed on Ledger. Never pay x402.
Master key never leaves Ledger; Key Ring holds keeper secrets.
${opts.brief ? `Composer note: ${opts.brief}` : ""}`,
    userContent: `${opts.userText}\n\nCall listActivePolicies now.`,
    tools: toolsFor([...ALLOW]),
    allow: ALLOW,
    ctx: opts.ctx,
    emit: opts.emit,
    runId: opts.runId,
    toolTrace: opts.toolTrace,
    forceToolsFirst: true,
  });
}
