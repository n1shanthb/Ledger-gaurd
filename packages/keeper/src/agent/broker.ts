/** @deprecated Phase A — Broker LLM removed; execute uses non-LLM payer. */
export async function runBroker(): Promise<string> {
  throw new Error("runBroker removed — use payer postPaidTrigger (Phase A)");
}
