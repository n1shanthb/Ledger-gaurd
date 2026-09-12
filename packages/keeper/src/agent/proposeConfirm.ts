import type { KeeperSecrets } from "../ring";
import type { Emit } from "./types";
import { runTool, type ToolCtx } from "./tools";
import type { PolicyDraft, PolicyDraftItem } from "./policyDraft";
import { createCapabilityBroker } from "../capabilities";

export async function confirmPolicyProposals(opts: {
  secrets: KeeperSecrets;
  draft: PolicyDraft;
  includeAddons?: boolean;
  emit?: Emit;
  runId?: string;
}): Promise<{
  proposals: { item: PolicyDraftItem; out: string }[];
  text: string;
}> {
  const runId = opts.runId ?? "propose";
  const emit: Emit = (ev) => opts.emit?.(ev);
  const ctx: ToolCtx = {
    secrets: opts.secrets,
    gateProceed: null,
    overrideExecute: false,
    broker: createCapabilityBroker(opts.secrets),
  };

  emit({
    type: "agent_start",
    runId,
    agent: "composer",
    model: "code:proposeGuardianPolicy",
  });

  const items: PolicyDraftItem[] = [opts.draft.primary];
  if (opts.includeAddons && opts.draft.addons?.length) {
    items.push(...opts.draft.addons);
  }

  const proposals: { item: PolicyDraftItem; out: string }[] = [];
  for (const item of items) {
    emit({
      type: "tool_start",
      runId,
      agent: "composer",
      tool: "proposeGuardianPolicy",
    });
    const result = await runTool(
      ctx,
      "proposeGuardianPolicy",
      JSON.stringify(item),
    );
    emit({
      type: "tool_end",
      runId,
      agent: "composer",
      tool: "proposeGuardianPolicy",
      ok: result.ok,
      summary: result.summary,
    });
    proposals.push({ item, out: result.out });
  }

  const text = [
    "Propose (HITL) — clear-sign on Ledger. Master key never leaves Ledger.",
    ...proposals.map(
      (p, i) =>
        `${i + 1}. ${p.item.strategyType} ${p.item.asset} amt=${p.item.amount}\n${p.out}`,
    ),
  ].join("\n\n");

  emit({
    type: "agent_message",
    runId,
    agent: "composer",
    text: text.slice(0, 800),
  });
  emit({ type: "agent_end", runId, agent: "composer" });

  return { proposals, text };
}
