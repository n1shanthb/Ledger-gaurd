import express from "express";
import { loadSecrets, ringStatus } from "./ring";
import { fetchActivePolicies, mcpHint } from "./subgraph";
import { feedForToken, fetchSpotUsd1e8, fetchVaas, shouldTrigger } from "./pyth";
import { executePolicy } from "./executor";
import { keeperX402 } from "./x402";

const secrets = loadSecrets();
const app = express();
app.use(express.json());

/** Operator loop + paid /trigger share this. x402 only wraps the HTTP route. */
async function runCycle() {
  const policies = await fetchActivePolicies(secrets.graphUrl, secrets.graphApiKey);
  const hits: { policyId: string; trigger: string; tx?: string }[] = [];

  for (const pol of policies) {
    const feed = feedForToken(pol.token);
    const spot = await fetchSpotUsd1e8(feed);
    const trigger = shouldTrigger(
      spot,
      BigInt(pol.stopLossPrice),
      BigInt(pol.takeProfitPrice),
    );
    if (!trigger) {
      console.log(
        `[lga] skip ${pol.id.slice(0, 10)}… spot=${Number(spot) / 1e8} stop=${Number(pol.stopLossPrice) / 1e8} take=${Number(pol.takeProfitPrice) / 1e8}`,
      );
      continue;
    }

    console.log(`[lga] hit ${trigger} ${pol.id.slice(0, 10)}… executing`);
    const vaas = await fetchVaas(feed);
    const tx = await executePolicy({
      rpc: secrets.baseRpc,
      sessionKey: secrets.sessionKey,
      manager: secrets.manager,
      policyId: pol.id,
      vaas,
    });
    hits.push({ policyId: pol.id, trigger, tx });
    console.log(`[lga] filled ${tx}`);
  }

  return {
    evaluated: policies.length,
    executed: hits,
    note:
      hits.length === 0 && policies.length > 0
        ? "No policy in range — wait for band or Instant-fill"
        : undefined,
  };
}

let lastPoll: { at: number; evaluated: number; executed: number } | null = null;
let pollBusy = false;

async function pollOnce() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const r = await Promise.race([
      runCycle(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("poll cycle timeout 90s")), 90_000),
      ),
    ]);
    lastPoll = {
      at: Date.now(),
      evaluated: r.evaluated,
      executed: r.executed.length,
    };
    if (r.executed.length) {
      console.log(`[lga] poll ok evaluated=${r.evaluated} filled=${r.executed.length}`);
    }
  } catch (err) {
    console.error("[lga] poll error", err instanceof Error ? err.message : err);
  } finally {
    pollBusy = false;
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mcp: mcpHint(secrets.graphUrl),
    keyRing: ringStatus(secrets),
    network: secrets.hederaNetwork,
    poll: {
      ms: Number(process.env.POLL_MS ?? 30_000),
      last: lastPoll,
    },
  });
});

app.get("/policies", async (_req, res) => {
  try {
    const policies = await fetchActivePolicies(secrets.graphUrl, secrets.graphApiKey);
    res.json({ policies, mcp: mcpHint(secrets.graphUrl) });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

if (!secrets.payTo) {
  console.warn("[lga] HEDERA_PAY_TO / HEDERA_ACCOUNT_ID missing — /trigger will 500 on 402 setup");
}

app.use(
  keeperX402({
    facilitator: secrets.facilitator,
    payTo: secrets.payTo,
    amount: secrets.paymentAmount,
    network: secrets.hederaNetwork,
  }),
);

app.post("/trigger", async (_req, res) => {
  try {
    res.json(await runCycle());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const port = Number(process.env.KEEPER_PORT ?? 3001);
const pollMs = Number(process.env.POLL_MS ?? 30_000);

app.listen(port, () => {
  const kr = ringStatus(secrets);
  console.log(`[lga] keeper :${port}  POST /trigger is x402-gated`);
  console.log(`[lga] Key Ring: ${kr.source} headless=${kr.headless}`);
  if (pollMs > 0) {
    console.log(`[lga] autopoll every ${pollMs}ms (set POLL_MS=0 to disable)`);
    void pollOnce();
    setInterval(() => void pollOnce(), pollMs);
  } else {
    console.log("[lga] autopoll off — use npm run pay or POLL_MS=30000");
  }
});
