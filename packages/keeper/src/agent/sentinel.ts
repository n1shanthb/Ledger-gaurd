import type { KeeperSecrets } from "../ring";
import type { Emit } from "./types";
import { toolsFor } from "./toolDefs";
import { runSpecialistLoop } from "./openrouter";
import type { ToolCtx } from "./tools";

const ALLOW = new Set(["listActivePolicies"]);

export async function runSentinel(opts: {
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
    agent: "sentinel",
    model: opts.secrets.openRouterModels.sentinel,
    system: `You are LGA Policy Sentinel. You ONLY use Receipt Graph tools.
Always call listActivePolicies. Never ask the user for more info.
Zero policies is a valid answer — say so and stop.
Never invent prices or TVL. Never claim you signed on Ledger.
Master key never leaves Ledger; Key Ring holds keeper secrets.
${opts.brief ? `Coordinator note: ${opts.brief}` : ""}`,
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
