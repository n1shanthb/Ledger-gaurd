/** Shared Guardian policy draft — keeper SSE + web form. */

export type StrategyType = "STOP_LOSS" | "TAKE_PROFIT" | "BUY_DIP" | "LP_RANGE";

export type PolicyDraftItem = {
  strategyType: StrategyType;
  asset: string;
  amount: string;
  stopLossUsd?: number;
  takeProfitUsd?: number;
  maxSlippageBps?: number;
  reasoning: string;
};

export type PolicyDraft = {
  status: "need_input" | "ready";
  questions: string[];
  suggestions: string[];
  primary: PolicyDraftItem;
  addons?: PolicyDraftItem[];
};

const STRATEGIES = new Set<StrategyType>([
  "STOP_LOSS",
  "TAKE_PROFIT",
  "BUY_DIP",
  "LP_RANGE",
]);

function asItem(raw: unknown, fallbackReason: string): PolicyDraftItem {
  const j = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const strategyType = STRATEGIES.has(j.strategyType as StrategyType)
    ? (j.strategyType as StrategyType)
    : "STOP_LOSS";
  return {
    strategyType,
    asset: typeof j.asset === "string" && j.asset ? j.asset : "WETH",
    amount: typeof j.amount === "string" ? j.amount : "",
    stopLossUsd:
      typeof j.stopLossUsd === "number" ? j.stopLossUsd : undefined,
    takeProfitUsd:
      typeof j.takeProfitUsd === "number" ? j.takeProfitUsd : undefined,
    maxSlippageBps:
      typeof j.maxSlippageBps === "number" ? j.maxSlippageBps : 100,
    reasoning:
      typeof j.reasoning === "string" && j.reasoning
        ? j.reasoning
        : fallbackReason,
  };
}

export function parsePolicyDraft(raw: string): PolicyDraft {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const slice =
    start >= 0 && end > start ? raw.slice(start, end + 1) : raw.trim();
  try {
    const j = JSON.parse(slice) as Record<string, unknown>;
    const primary = asItem(j.primary ?? j, "NL policy draft");
    const questions = Array.isArray(j.questions)
      ? j.questions.filter((q): q is string => typeof q === "string")
      : [];
    const suggestions = Array.isArray(j.suggestions)
      ? j.suggestions.filter((q): q is string => typeof q === "string")
      : [];
    const addons = Array.isArray(j.addons)
      ? j.addons.map((a) => asItem(a, "optional addon"))
      : undefined;
    return withDraftStatus({
      status: "need_input",
      questions,
      suggestions,
      primary,
      addons,
    });
  } catch {
    return withDraftStatus({
      status: "need_input",
      questions: [
        "How much do you want to protect or spend?",
        "What price band should trigger the policy?",
      ],
      suggestions: ["Default max slippage 1% (100 bps) is usually fillable."],
      primary: {
        strategyType: "STOP_LOSS",
        asset: "WETH",
        amount: "",
        maxSlippageBps: 100,
        reasoning: "parse fallback — need user input",
      },
    });
  }
}

export function draftIsReady(d: PolicyDraft): boolean {
  const p = d.primary;
  const amountOk = p.amount.trim().length > 0;
  const bandOk =
    p.strategyType === "BUY_DIP"
      ? p.takeProfitUsd != null || p.stopLossUsd != null
      : p.stopLossUsd != null || p.takeProfitUsd != null;
  return amountOk && bandOk;
}

export function withDraftStatus(d: PolicyDraft): PolicyDraft {
  const ready = draftIsReady(d);
  const questions = [...d.questions];
  if (!ready) {
    if (!d.primary.amount.trim() && !questions.some((q) => /how much|amount|size/i.test(q))) {
      questions.push("How much size should this policy cover?");
    }
    if (
      d.primary.stopLossUsd == null &&
      d.primary.takeProfitUsd == null &&
      !questions.some((q) => /band|price|trigger|stop|dip/i.test(q))
    ) {
      questions.push("What USD trigger band should we clear-sign?");
    }
  }
  return {
    ...d,
    status: ready ? "ready" : "need_input",
    questions: ready ? [] : questions,
  };
}

/** Spot-based stop suggestion (same idea as web suggestStopFromSpot). */
export function suggestStopUsd(spotUsd: number, pctBelow = 5): number {
  if (!Number.isFinite(spotUsd) || spotUsd <= 0) return 0;
  const v = spotUsd * (1 - pctBelow / 100);
  return spotUsd > 1000 ? Math.round(v) : Math.round(v * 100) / 100;
}

export function enrichDraftFromSpot(
  draft: PolicyDraft,
  spotUsd: number | null,
): PolicyDraft {
  let d = { ...draft, primary: { ...draft.primary } };
  const suggestions = [...(d.suggestions ?? [])];
  if (spotUsd != null && spotUsd > 0) {
    if (d.primary.maxSlippageBps == null) d.primary.maxSlippageBps = 100;
    if (
      d.primary.strategyType === "STOP_LOSS" &&
      d.primary.stopLossUsd == null
    ) {
      d.primary.stopLossUsd = suggestStopUsd(spotUsd, 5);
      suggestions.push(
        `Suggested stop ~5% below spot $${spotUsd.toFixed(2)} → $${d.primary.stopLossUsd}`,
      );
    }
    if (
      d.primary.strategyType === "BUY_DIP" &&
      d.primary.takeProfitUsd == null &&
      d.primary.stopLossUsd == null
    ) {
      d.primary.takeProfitUsd = suggestStopUsd(spotUsd, 5);
      suggestions.push(
        `Suggested buy-dip trigger ~5% below spot $${spotUsd.toFixed(2)} → $${d.primary.takeProfitUsd}`,
      );
    }
    if (!suggestions.some((s) => /slippage|bps/i.test(s))) {
      suggestions.push("Default max slippage 1% (100 bps) is usually fillable.");
    }
  }
  d.suggestions = suggestions;
  return withDraftStatus(d);
}

export function draftSummary(d: PolicyDraft): string {
  const p = d.primary;
  const band =
    p.stopLossUsd != null
      ? `stop $${p.stopLossUsd}`
      : p.takeProfitUsd != null
        ? `take/buy $${p.takeProfitUsd}`
        : "band TBD";
  const lines = [
    `Draft ${d.status}: ${p.strategyType} ${p.asset} amt=${p.amount || "?"} · ${band} · slip ${p.maxSlippageBps ?? 100}bps`,
    ...d.suggestions.slice(0, 3).map((s) => `• ${s}`),
    ...d.questions.slice(0, 4).map((q) => `? ${q}`),
  ];
  if (d.addons?.length) {
    lines.push(
      `Optional addons: ${d.addons.map((a) => a.strategyType).join(", ")}`,
    );
  }
  return lines.join("\n");
}

/** Shallow merge onto primary — does not remount/reset addons or wipe unset fields. */
export function patchDraft(
  draft: PolicyDraft,
  patch: Partial<PolicyDraftItem>,
): PolicyDraft {
  const primary: PolicyDraftItem = { ...draft.primary };
  if (patch.strategyType != null) primary.strategyType = patch.strategyType;
  if (patch.asset != null && patch.asset.trim()) primary.asset = patch.asset;
  if (patch.amount != null) primary.amount = patch.amount;
  if (patch.stopLossUsd !== undefined) primary.stopLossUsd = patch.stopLossUsd;
  if (patch.takeProfitUsd !== undefined)
    primary.takeProfitUsd = patch.takeProfitUsd;
  if (patch.maxSlippageBps !== undefined)
    primary.maxSlippageBps = patch.maxSlippageBps;
  if (patch.reasoning != null && patch.reasoning.trim())
    primary.reasoning = patch.reasoning;
  return withDraftStatus({ ...draft, primary });
}

/** Parse a natural-language field edit into a primary patch. */
export function patchFromUserText(
  userText: string,
  current: PolicyDraftItem,
): Partial<PolicyDraftItem> {
  const t = userText.trim();
  const patch: Partial<PolicyDraftItem> = {};

  const amt =
    t.match(
      /\b(?:make\s+it|set\s+(?:amount\s+)?(?:to\s+)?|use|amount\s*[:=]?\s*)(\d+(?:\.\d+)?)\s*(eth|weth|usdc)?\b/i,
    ) || t.match(/^(\d+(?:\.\d+)?)\s*(eth|weth|usdc)?$/i);
  if (amt) {
    patch.amount = amt[1];
    if (amt[2] && /usdc/i.test(amt[2])) patch.asset = "USDC";
    else if (amt[2]) patch.asset = "WETH";
  }

  const stop = t.match(
    /\b(?:stop(?:\s*loss)?|sl)\s*(?:to|=|:)?\s*\$?(\d+(?:\.\d+)?)/i,
  );
  if (stop) patch.stopLossUsd = Number(stop[1]);

  const take = t.match(
    /\b(?:take(?:\s*profit)?|tp|buy(?:\s*-?\s*dip)?(?:\s*trigger)?)\s*(?:to|=|:)?\s*\$?(\d+(?:\.\d+)?)/i,
  );
  if (take) patch.takeProfitUsd = Number(take[1]);

  const slip = t.match(/\b(?:slip(?:page)?|bps)\s*(?:to|=|:)?\s*(\d+)\b/i);
  if (slip) patch.maxSlippageBps = Number(slip[1]);

  const asset = t.match(/\b(?:asset|token)\s*(?:to|=|:)?\s*(weth|eth|usdc|cbbtc|btc)\b/i);
  if (asset) {
    const a = asset[1].toLowerCase();
    patch.asset =
      a === "btc" || a === "cbbtc" ? "cbBTC" : a === "usdc" ? "USDC" : "WETH";
  }

  if (Object.keys(patch).length === 0 && current) {
    // bare number with eth context already handled; leave empty for LLM-less stub
  }
  return patch;
}
