import type { KeeperSecrets } from "../ring";
import type { Emit } from "./types";
import { toolsFor } from "./toolDefs";
import { runSpecialistLoop } from "./openrouter";
import type { ToolCtx } from "./tools";

/** Status via Subgraph MCP consumer + optional x402 payment list. */
const ALLOW = new Set(["queryReceiptGraphNl", "getRecentPayments"]);

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
    system: `You are LGA Receipt Clerk — status only for the Use Case agent/app (not a tooling MCP product).
HARD RULES:
- Always call queryReceiptGraphNl first with the user's natural-language question (Subgraph MCP consumer → live Subgraph Studio Receipt Graph).
- Call getRecentPayments only for keeper x402 / HashScan / HBAR attempt history.
- Zero policies / empty receipts is valid — say so from live data; never invent.
- Never claim you signed on Ledger. Never pay x402.
Master key never leaves Ledger; Key Ring holds keeper secrets.
${opts.brief ? `Composer note: ${opts.brief}` : ""}`,
    userContent: `${opts.userText}

Call queryReceiptGraphNl now with {"question":"<user ask>"}.`,
    tools: toolsFor([...ALLOW]),
    allow: ALLOW,
    ctx: opts.ctx,
    emit: opts.emit,
    runId: opts.runId,
    toolTrace: opts.toolTrace,
    forceToolsFirst: true,
    forceToolName: "queryReceiptGraphNl",
  });
}
