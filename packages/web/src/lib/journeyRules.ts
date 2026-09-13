/**
 * Pure helpers for journey UX — kept free of React for cheap unit checks.
 */

export type StageId =
  | "device"
  | "asset"
  | "strategy"
  | "limits"
  | "review"
  | "signing"
  | "monitor"
  | "outcome"
  | "kill";

const FLOW: StageId[] = [
  "device",
  "asset",
  "strategy",
  "limits",
  "review",
  "signing",
  "monitor",
  "outcome",
];

export function canAdvance(from: StageId, to: StageId): boolean {
  if (to === "kill") return true;
  if (from === "kill") return to === "outcome" || to === "monitor" || to === "device";
  const a = FLOW.indexOf(from);
  const b = FLOW.indexOf(to);
  if (a < 0 || b < 0) return false;
  return b <= a + 1;
}

export function liveSignBlocked(mode: "demo" | "live", limitsAck: boolean): boolean {
  return mode === "live" && !limitsAck;
}

export function killBlocked(connected: boolean, killAck: boolean, busy: boolean): boolean {
  return !connected || !killAck || busy;
}

export function paymentIsNotFill(executedCount: number): boolean {
  return executedCount === 0;
}

export function labelPaymentAttempt(executedCount: number): string {
  return executedCount > 0 ? "eval + fill" : "payment / eval";
}
