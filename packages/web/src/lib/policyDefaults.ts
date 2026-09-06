import type { Address } from "viem";
import { BASE_TOKENS } from "./abi";
import type { PolicyFormValues } from "./policyTx";

export type PolicyTypeId = 0 | 1 | 2 | 3;

export function chartAssetForToken(token: string): "eth" | "btc" {
  return token.toLowerCase() === BASE_TOKENS.CBBTC.toLowerCase() ? "btc" : "eth";
}

/** Defaults when switching policy type — token + units + empty/seed levels. */
export function formDefaultsForType(
  policyType: PolicyTypeId,
  spotUsd: number | null,
): Pick<
  PolicyFormValues,
  | "policyType"
  | "token"
  | "maxAmount"
  | "maxAmountUnit"
  | "stopLossUsd"
  | "takeProfitUsd"
  | "maxSlippagePercent"
> {
  const spot = spotUsd != null && Number.isFinite(spotUsd) ? spotUsd : null;
  const n = (x: number) => x.toFixed(2);

  if (policyType === 1) {
    return {
      policyType,
      token: BASE_TOKENS.WETH as Address,
      maxAmount: "0.0001",
      maxAmountUnit: "eth",
      stopLossUsd: "0",
      takeProfitUsd: spot != null ? n(spot + 10) : "4000",
      maxSlippagePercent: "0.5",
    };
  }
  if (policyType === 2) {
    return {
      policyType,
      token: BASE_TOKENS.WETH as Address,
      maxAmount: "0.0001",
      maxAmountUnit: "eth",
      stopLossUsd: spot != null ? n(spot - 10) : "2700",
      takeProfitUsd: spot != null ? n(spot + 10) : "2900",
      maxSlippagePercent: "0.5",
    };
  }
  if (policyType === 3) {
    return {
      policyType,
      token: BASE_TOKENS.WETH as Address,
      maxAmount: "1",
      maxAmountUnit: "usdc",
      stopLossUsd: spot != null ? n(spot - 1) : "2400",
      takeProfitUsd: "0",
      maxSlippagePercent: "0.5",
    };
  }
  // stop-loss sell
  return {
    policyType: 0,
    token: BASE_TOKENS.WETH as Address,
    maxAmount: "0.0001",
    maxAmountUnit: "eth",
    stopLossUsd: spot != null ? n(spot - 10) : "2800",
    takeProfitUsd: "0",
    maxSlippagePercent: "0.5",
  };
}

export function policyTypeLabel(t: PolicyTypeId): string {
  if (t === 1) return "Take-profit (sell)";
  if (t === 2) return "LP bounds (sell)";
  if (t === 3) return "Buy-dip (USDC → ETH)";
  return "Stop-loss (sell)";
}
