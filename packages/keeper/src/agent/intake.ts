import type { KeeperSecrets } from "../ring";
import type { Emit } from "./types";
import { openRouterJson } from "./openrouter";
import { runTool, type ToolCtx } from "./tools";
import {
  draftSummary,
  enrichDraftFromSpot,
  parsePolicyDraft,
  type PolicyDraft,
} from "./policyDraft";

export async function runPolicyIntake(opts: {
  secrets: KeeperSecrets;
  userMessages: { role: "user" | "assistant"; content: string }[];
  brief: string;
  ctx: ToolCtx;
  emit: Emit;
  runId: string;
  toolTrace: string[];
}): Promise<{ draft: PolicyDraft; text: string }> {
  const model = opts.secrets.openRouterModels.composer;
  opts.emit({
    type: "agent_start",
    runId: opts.runId,
    agent: "composer",
    model,
  });

  opts.toolTrace.push("composer:getPythSpot");
  opts.emit({
    type: "tool_start",
    runId: opts.runId,
    agent: "composer",
    tool: "getPythSpot",
  });
  const spotRes = await runTool(
    opts.ctx,
    "getPythSpot",
    JSON.stringify({ asset: "eth" }),
  );
  opts.emit({
    type: "tool_end",
    runId: opts.runId,
    agent: "composer",
    tool: "getPythSpot",
    ok: spotRes.ok,
    summary: spotRes.summary,
  });

  const history = opts.userMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .slice(-6000);

  const system = `You are LGA Intent Composer — policy intake for Ledger clear-sign.
Master key never leaves Ledger; Key Ring holds keeper secrets.
Never pay x402. Never claim a tx broadcast. Never invent wallet balances.

Return ONLY JSON:
{
  "status": "need_input" | "ready",
  "questions": string[],
  "suggestions": string[],
  "primary": {
    "strategyType": "STOP_LOSS"|"TAKE_PROFIT"|"BUY_DIP"|"LP_RANGE",
    "asset": string,
    "amount": string,
    "stopLossUsd"?: number,
    "takeProfitUsd"?: number,
    "maxSlippageBps"?: number,
    "reasoning": string
  },
  "addons"?: [ same shape as primary ]
}

Rules:
- Suggest sensible defaults from spot (e.g. stop a few % below spot, slippage ~100 bps) — explain in suggestions[].
- If amount or trigger band missing, status=need_input and ask concrete questions[].
- status=ready only when amount is non-empty AND at least one of stopLossUsd/takeProfitUsd is set.
- Optionally include addons[] (e.g. a buy-the-dip companion) — never force; user may ignore.
- Do not string-match specific user phrases; reason from the conversation.
${opts.brief ? `Classifier note: ${opts.brief}` : ""}`;

  const user = `Conversation:
${history}

Pyth tool result: ${spotRes.out}

Produce the policy draft JSON now.`;

  const raw = await openRouterJson({
    apiKey: opts.secrets.openRouterApiKey,
    model,
    system,
    user,
  });
  let spotUsd: number | null = null;
  try {
    const spotJ = JSON.parse(spotRes.out) as { usd?: number };
    if (typeof spotJ.usd === "number" && spotJ.usd > 0) spotUsd = spotJ.usd;
  } catch {
    /* ignore */
  }
  const draft = enrichDraftFromSpot(parsePolicyDraft(raw), spotUsd);
  const text = draftSummary(draft);

  opts.emit({
    type: "policy_draft",
    runId: opts.runId,
    draft,
  });
  opts.emit({
    type: "agent_message",
    runId: opts.runId,
    agent: "composer",
    text: text.slice(0, 800),
  });
  opts.emit({ type: "agent_end", runId: opts.runId, agent: "composer" });

  return { draft, text };
}
