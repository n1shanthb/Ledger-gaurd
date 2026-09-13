import { usdFrom1e8 } from "@/lib/constants";

export type FillNotice = {
  trigger: string;
  pyth: string;
  fill: string;
  when: string;
  tx: string;
  compliant: boolean;
  policyId?: string;
  slippage?: string;
};

export function triggerLabelShort(raw: string | number): string {
  const s = String(raw);
  if (s === "TAKE_PROFIT" || s === "1") return "Take-profit";
  if (s === "BUY_DIP" || s === "3") return "Buy-dip";
  if (s === "LP_STOP_LOSS" || s === "2") return "LP stop-loss";
  return "Stop-loss";
}

/** Map a real Graph / on-chain ExecutionReceipt into the congrats card. */
export function receiptToFillNotice(r: {
  triggerType: string | number;
  pythPrice: string;
  executionPrice: string;
  timestamp?: string | number;
  txHash: string;
  compliant: boolean;
  actualSlippageBps?: string | number;
  policy?: { id: string };
  policyId?: string;
}): FillNotice {
  const ts =
    r.timestamp != null && Number(r.timestamp) > 0
      ? Number(r.timestamp) * (Number(r.timestamp) > 1e12 ? 1 : 1000)
      : Date.now();
  const when = new Date(ts).toLocaleString();
  const slip =
    r.actualSlippageBps != null && r.actualSlippageBps !== ""
      ? `${(Number(r.actualSlippageBps) / 100).toFixed(2)}%`
      : undefined;
  return {
    trigger: triggerLabelShort(r.triggerType),
    pyth: usdFrom1e8(r.pythPrice),
    fill: usdFrom1e8(r.executionPrice),
    when,
    tx: r.txHash.startsWith("0x") ? r.txHash : `0x${r.txHash}`,
    compliant: r.compliant,
    policyId: r.policy?.id ?? r.policyId,
    slippage: slip,
  };
}
