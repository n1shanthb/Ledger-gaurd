import type { KeeperSecrets } from "./ring";
import { findHitPolicies } from "./cycle";
import { postPaidTrigger } from "./paidTrigger";
import { graphCooldownRemaining } from "./graphGuard";

/** Watch policies + Pyth; on band hit, pay x402 → POST /trigger. */
export function startPayOnHit(secrets: KeeperSecrets) {
  // Default 90s — Graph policy list is cached separately; Hermes ticks this often.
  // Fill take / video: WATCH_MS=5000 for snappy band checks (still rare Graph hits if cache warm).
  const watchMs = Number(process.env.WATCH_MS ?? 90_000);
  const base =
    process.env.KEEPER_URL?.replace(/\/$/, "") ??
    `http://127.0.0.1:${process.env.PORT ?? process.env.KEEPER_PORT ?? 3001}`;
  process.env.KEEPER_URL = base;

  /** Paid attempt finished (fill or definitive fail) — do not re-burn HBAR. */
  const settled = new Set<string>();
  let lastCoolLog = 0;
  console.log(`[lga] pay-on-hit Autopilot watch every ${watchMs}ms → ${base}`);

  async function tick() {
    const cool = graphCooldownRemaining();
    if (cool > 0 && Date.now() - lastCoolLog > 25_000) {
      console.warn(
        `[lga] pay-on-hit: Graph cooling ~${Math.ceil(cool / 1000)}s — cache+Hermes only (no Studio poll)`,
      );
      lastCoolLog = Date.now();
    }

    try {
      const hits = await findHitPolicies(secrets);
      if (!hits.length) {
        console.log("[lga] pay-on-hit Autopilot: no band hits");
        return;
      }
      const fresh = hits.filter((h) => !settled.has(h.pol.id));
      if (!fresh.length) {
        console.log(
          "[lga] pay-on-hit Autopilot: hits already settled this process (fill or not-triggered)",
        );
        return;
      }
      for (const h of fresh) {
        console.log(
          `[lga] pay-on-hit Autopilot: ${h.trigger} ${h.pol.id.slice(0, 10)}… spot=${Number(h.spot) / 1e8} → paid /trigger`,
        );
      }
      const result = await postPaidTrigger(secrets, "trigger", {
        agentId: "autopilot",
      });
      console.log(
        "[lga] pay-on-hit Autopilot status",
        result.status,
        result.body.slice(0, 400),
      );
      if (result.hashscanUrl) console.log("[lga] hashscan", result.hashscanUrl);

      const body = result.body ?? "";
      const ok = result.status >= 200 && result.status < 300;
      const notTriggered = /not triggered/i.test(body);
      // Settle on fill success OR definitive on-chain reject — stop HBAR burn loop
      if (ok || notTriggered) {
        for (const h of fresh) settled.add(h.pol.id);
        if (notTriggered) {
          console.warn(
            "[lga] pay-on-hit: on-chain Pyth said not triggered (spot moved vs stop). Settled — no re-pay.",
          );
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/429|cooling|rate limit|busy/i.test(msg)) {
        if (Date.now() - lastCoolLog > 25_000) {
          console.warn(
            "[lga] pay-on-hit Autopilot waiting on Graph cooldown (Hermes watch paused until cache or cool-down ends)",
          );
          lastCoolLog = Date.now();
        }
        return;
      }
      if (/fetch failed|ECONNREFUSED|ENOTFOUND|timed out|TimeoutError/i.test(msg)) {
        console.error(
          `[lga] pay-on-hit: cannot reach ${base}/trigger — start keeper host first:\n` +
            `  WALLET_PASS=… POLL_MS=0 npm start\n` +
            `  (or set KEEPER_URL=https://your.railway.app)\n` +
            `  Autopilot alone is the payer; it needs a live /trigger host.`,
        );
        return;
      }
      console.error("[lga] pay-on-hit Autopilot error", msg);
    }
  }

  void tick();
  setInterval(() => void tick(), watchMs);
}
