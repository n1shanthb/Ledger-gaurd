import { loadSecrets } from "./ring";
import { findHitPolicies } from "./cycle";
import { postPaidTrigger } from "./paidTrigger";

const secrets = loadSecrets();
const watchMs = Number(process.env.WATCH_MS ?? 15_000);
const paid = new Set<string>();

console.log(
  `[lga] pay-on-hit watch every ${watchMs}ms → ${process.env.KEEPER_URL ?? "http://127.0.0.1:3001"}`,
);

async function tick() {
  try {
    const hits = await findHitPolicies(secrets);
    if (!hits.length) {
      console.log("[lga] pay-on-hit: no band hits");
      return;
    }
    const fresh = hits.filter((h: (typeof hits)[number]) => !paid.has(h.pol.id));
    if (!fresh.length) {
      console.log("[lga] pay-on-hit: hits already paid this process");
      return;
    }
    for (const h of fresh) {
      console.log(
        `[lga] pay-on-hit: ${h.trigger} ${h.pol.id.slice(0, 10)}… spot=${Number(h.spot) / 1e8} → paid /trigger`,
      );
    }
    const result = await postPaidTrigger(secrets, "trigger");
    console.log("[lga] pay-on-hit status", result.status, result.body.slice(0, 400));
    if (result.hashscanUrl) console.log("[lga] hashscan", result.hashscanUrl);
    if (result.status >= 200 && result.status < 300) {
      for (const h of fresh) paid.add(h.pol.id);
    }
  } catch (e) {
    console.error("[lga] pay-on-hit error", e instanceof Error ? e.message : e);
  }
}

void tick();
setInterval(() => void tick(), watchMs);
