import type { KeeperSecrets } from "../ring";
import type { Emit } from "./types";
import { toolsFor } from "./toolDefs";
import { runSpecialistLoop } from "./openrouter";
import {
  asClerkCtx,
  runClerkTool,
  type ClerkToolName,
  type ToolCtx,
} from "./tools";

/** Status via Subgraph MCP consumer + optional x402 payment list.
 * Exactly one Receipt Graph hit per ask: queryReceiptGraphNl only (no listActivePolicies). */
const ALLOW = new Set<ClerkToolName>([
  "queryReceiptGraphNl",
  "getRecentPayments",
]);

export async function runClerk(opts: {
  secrets: KeeperSecrets;
  userText: string;
  brief: string;
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
}): Promise<string> {
  const clerkCtx = asClerkCtx(opts.ctx);
  return runSpecialistLoop({
    secrets: opts.secrets,
    agent: "clerk",
    model: opts.secrets.openRouterModels.clerk,
    system: `You are LGA's Receipt Clerk — friendly status desk for this app.
Talk like a helpful teammate. Short and clear.
Rules:
- Call queryReceiptGraphNl first with the user's question.
- Empty results are fine — say so honestly.
- 2–4 natural sentences. No JSON dumps, no raw URLs, no markdown walls.
- Never claim you signed on Ledger. Never pay x402.
Master key never leaves Ledger; Key Ring holds keeper secrets.
${opts.brief ? `Composer note: ${opts.brief}` : ""}`,
    userContent: `${opts.userText}

Call queryReceiptGraphNl with {"question":"<user ask>"}, then answer in plain language.`,
    tools: toolsFor([...ALLOW]),
    allow: new Set(ALLOW),
    ctx: opts.ctx,
    executeTool: (name, args) => {
      if (!ALLOW.has(name as ClerkToolName)) {
        return Promise.resolve({
          out: JSON.stringify({ error: `clerk cannot run ${name}` }),
          summary: "disallowed",
          ok: false,
        });
      }
      return runClerkTool(clerkCtx, name as ClerkToolName, args);
    },
    emit: opts.emit,
    runId: opts.runId,
    toolTrace: opts.toolTrace,
    forceToolsFirst: true,
    forceToolName: "queryReceiptGraphNl",
  });
}
