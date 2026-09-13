import type { KeeperSecrets } from "./ring";
import { findHitPolicies } from "./cycle";
import { postPaidTrigger } from "./paidTrigger";

/** Watch policies + Pyth; on band hit, pay x402 → POST /trigger. */
export function startPayOnHit(secrets: KeeperSecrets) {
  const watchMs = Number(process.env.WATCH_MS ?? 15_000);
  const base =
    process.env.KEEPER_URL?.replace(/\/$/, "") ??
    `http://127.0.0.1:${process.env.PORT ?? process.env.KEEPER_PORT ?? 3001}`;
  process.env.KEEPER_URL = base;

  /** Paid attempt finished (fill or definitive fail) — do not re-burn HBAR. */
  const settled = new Set<string>();
  console.log(`[lga] pay-on-hit Autopilot watch every ${watchMs}ms → ${base}`);

  async function tick() {
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
      console.log("[lga] pay-on-hit Autopilot status", result.status, result.body.slice(0, 400));
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
      console.error("[lga] pay-on-hit Autopilot error", e instanceof Error ? e.message : e);
    }
  }

  void tick();
  setInterval(() => void tick(), watchMs);
}
