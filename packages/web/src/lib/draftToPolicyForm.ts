import type { Address } from "viem";
import { BASE_TOKENS } from "@/lib/abi";
import type { PolicyDraft, StrategyType } from "@/lib/agentEvents";
import type { PolicyFormValues } from "@/lib/policyTx";

function strategyToPolicyType(s: StrategyType): 0 | 1 | 2 | 3 {
  if (s === "TAKE_PROFIT") return 1;
  if (s === "LP_RANGE") return 2;
  if (s === "BUY_DIP") return 3;
  return 0;
}

function tokenForDraft(item: PolicyDraft["primary"]): Address {
  const a = item.asset.trim().toLowerCase();
  if (a.includes("btc") || a === "cbbtc") return BASE_TOKENS.CBBTC as Address;
  return BASE_TOKENS.WETH as Address;
}

/** Map agent PolicyDraft → on-chain form used by DMK clear-sign. */
export function draftToPolicyForm(draft: PolicyDraft): PolicyFormValues {
  const item = draft.primary;
  const policyType = strategyToPolicyType(item.strategyType);
  const buy = policyType === 3;
  const slipPct =
    item.maxSlippageBps != null
      ? String(Math.max(0.01, item.maxSlippageBps / 100))
      : "1";

  // Buy-dip: chain uses takeProfit as buy trigger; agent may put band in either field
  const trigger =
    item.takeProfitUsd ?? item.stopLossUsd ?? undefined;
  const stop =
    policyType === 1
      ? "0"
      : buy
        ? item.stopLossUsd != null
          ? String(item.stopLossUsd)
          : "0"
        : item.stopLossUsd != null
          ? String(item.stopLossUsd)
          : "0";
  const take =
    policyType === 0 && !buy
      ? item.takeProfitUsd != null
        ? String(item.takeProfitUsd)
        : "0"
      : buy
        ? trigger != null
          ? String(trigger)
          : "0"
        : item.takeProfitUsd != null
          ? String(item.takeProfitUsd)
          : "0";

  return {
    token: tokenForDraft(item),
    policyType,
    stopLossUsd: stop,
    takeProfitUsd: take,
    maxAmount: item.amount.trim() || "0",
    maxAmountUnit: buy ? "usdc" : "eth",
    maxSlippagePercent: slipPct,
  };
}
