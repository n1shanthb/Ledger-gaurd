/**
 * Shared Studio rate-limit guard — free-tier 429s cascade across Clerk/pay/cycle.
 * Escalates cooldown on repeated 429s; success resets the ladder.
 */
let blockedUntil = 0;
let lastStatus = 0;
let strike = 0;

const BASE_MS = Number(process.env.GRAPH_COOLDOWN_MS ?? 45_000);
const MAX_MS = Number(process.env.GRAPH_COOLDOWN_MAX_MS ?? 180_000);

export function markGraphRateLimited(ms?: number) {
  strike = Math.min(strike + 1, 4);
  const escalated =
    ms ?? Math.min(BASE_MS * 2 ** Math.max(0, strike - 1), MAX_MS);
  blockedUntil = Date.now() + escalated;
  lastStatus = 429;
  console.warn(
    `[lga] Receipt Graph cooling down ${escalated}ms (Studio rate limit, strike=${strike})`,
  );
}

export function markGraphOk() {
  lastStatus = 200;
  strike = 0;
}

export function graphCooldownRemaining(): number {
  return Math.max(0, blockedUntil - Date.now());
}

export function assertGraphAvailable(): void {
  const left = graphCooldownRemaining();
  if (left > 0) {
    throw new Error(
      `Receipt Graph cooling down ~${Math.ceil(left / 1000)}s after Studio rate limit (429). Try again shortly — this is The Graph free-tier quota, not a Ledger error.`,
    );
  }
}

export function noteGraphHttpStatus(status: number) {
  lastStatus = status;
  if (status === 429) markGraphRateLimited();
  else if (status >= 200 && status < 300) markGraphOk();
}

export function lastGraphStatus() {
  return lastStatus;
}
