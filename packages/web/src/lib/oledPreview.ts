import type { Address } from "viem";
import { formatUnits } from "viem";
import { BASE_TOKENS, tokenDecimals } from "./abi";
import type { PolicyFormValues } from "./policyTx";

const TOKEN_TICKER: Record<string, string> = {
  [BASE_TOKENS.WETH.toLowerCase()]: "ETH (WETH)",
  [BASE_TOKENS.CBBTC.toLowerCase()]: "BTC (cbBTC)",
  [BASE_TOKENS.USDC.toLowerCase()]: "USDC",
  [BASE_TOKENS.cbETH.toLowerCase()]: "cbETH",
};

function policyTypeLabel(t: number): string {
  if (t === 1) return "Take-Profit";
  if (t === 2) return "LP Stop-Loss";
  if (t === 3) return "Buy-Dip";
  return "Stop-Loss";
}

/** Human-readable text shown on Ledger OLED via personal_sign before the real tx. */
export function policyReviewMessage(
  form: PolicyFormValues,
  opts?: { autoWrap?: boolean; buyDip?: boolean },
): string {
  const ticker = TOKEN_TICKER[form.token.toLowerCase()] ?? form.token.slice(0, 10);
  const unit =
    opts?.buyDip || form.maxAmountUnit === "usdc"
      ? "USDC"
      : form.maxAmountUnit === "eth"
        ? "ETH"
        : form.token.toLowerCase() === BASE_TOKENS.CBBTC.toLowerCase()
          ? "BTC"
          : "tokens";

  const lines = [
    "LGA Guardian Policy",
    "",
    `Type: ${policyTypeLabel(form.policyType)}`,
    opts?.buyDip ? `Buy: ${ticker}` : `Asset: ${ticker}`,
  ];

  if (opts?.buyDip) {
    if (Number(form.stopLossUsd) > 0) {
      lines.push(`Buy if ETH <= $${form.stopLossUsd}`);
    }
    if (Number(form.takeProfitUsd) > 0) {
      lines.push(`Buy if ETH >= $${form.takeProfitUsd}`);
    }
    lines.push(`Spend: ${form.maxAmount} USDC`);
  } else {
    if (form.policyType !== 1 && Number(form.stopLossUsd) > 0) {
      lines.push(`Stop-loss: $${form.stopLossUsd}`);
    }
    if (form.policyType !== 0 || Number(form.takeProfitUsd) > 0) {
      if (Number(form.takeProfitUsd) > 0) {
        lines.push(`Take-profit: $${form.takeProfitUsd}`);
      }
    }
    lines.push(`Max amount: ${form.maxAmount} ${unit}`);
  }

  lines.push(`Slippage: ${form.maxSlippagePercent}%`);

  if (opts?.buyDip) {
    lines.push("", "Spends USDC → receives WETH", "when Pyth hits level");
  } else if (opts?.autoWrap) {
    lines.push(
      "",
      "ETH auto-wraps to WETH",
      "Ledger Live shows WETH",
      "until exit fills to USDC",
    );
  }

  lines.push("", "Approve = continue to tx", "Reject = cancel");

  return lines.join("\n");
}

export function killReviewMessage(): string {
  return [
    "LGA Kill Switch",
    "",
    "Revoke ALL guardian policies",
    "and disable keeper session keys",
    "for this wallet.",
    "",
    "Approve = continue to tx",
    "Reject = cancel",
  ].join("\n");
}

export function formatOledPreviewRows(form: PolicyFormValues): { label: string; value: string }[] {
  const ticker = TOKEN_TICKER[form.token.toLowerCase()] ?? form.token;
  const buy = form.policyType === 3;
  const isWeth = form.token.toLowerCase() === BASE_TOKENS.WETH.toLowerCase();
  const rows: { label: string; value: string }[] = [
    {
      label: "Intent",
      value: buy ? "Buy with USDC when price hits" : "Set Guardian Exit Policy",
    },
    { label: "Policy Type", value: policyTypeLabel(form.policyType) },
    { label: buy ? "Buy Asset" : "Protected Asset", value: ticker },
  ];
  if (buy) {
    if (Number(form.stopLossUsd) > 0) {
      rows.push({ label: "Buy ≤ (dip)", value: `$${form.stopLossUsd} USD` });
    }
    if (Number(form.takeProfitUsd) > 0) {
      rows.push({ label: "Buy ≥ (breakout)", value: `$${form.takeProfitUsd} USD` });
    }
    rows.push({
      label: "USDC to spend",
      value: `${form.maxAmount} USDC`,
    });
  } else {
    if (form.policyType !== 1 && Number(form.stopLossUsd) > 0) {
      rows.push({ label: "Stop-Loss Floor", value: `$${form.stopLossUsd} USD` });
    }
    if (form.policyType !== 0 || Number(form.takeProfitUsd) > 0) {
      if (Number(form.takeProfitUsd) > 0) {
        rows.push({
          label: "Take-Profit Target",
          value: `$${form.takeProfitUsd} USD`,
        });
      }
    }
    rows.push({
      label: "Max Trade Amount",
      value: `${form.maxAmount} ${form.maxAmountUnit === "eth" ? "ETH" : "token"}`,
    });
  }
  rows.push({ label: "Max Slippage", value: `${form.maxSlippagePercent}%` });
  if (buy) {
    rows.push({
      label: "On fill",
      value: "USDC → WETH in Ledger Live",
    });
  } else if (isWeth) {
    rows.push({
      label: "Until fill",
      value: "Held as WETH in Ledger Live → USDC on exit",
    });
  }
  return rows;
}

export function suggestStopFromSpot(spotUsd: number, pctBelow = 5): string {
  if (!Number.isFinite(spotUsd) || spotUsd <= 0) return "";
  return (spotUsd * (1 - pctBelow / 100)).toFixed(spotUsd > 1000 ? 0 : 2);
}

export function formatTokenAmount(raw: bigint, token: Address): string {
  const dec = token === ("0x0000000000000000000000000000000000000000" as Address) ? 18 : tokenDecimals(token);
  const n = Number(formatUnits(raw, dec));
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toPrecision(4);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}
