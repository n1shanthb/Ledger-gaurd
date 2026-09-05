import express from "express";
import { loadSecrets, ringStatus } from "./ring";
import { fetchActivePolicies, mcpHint } from "./subgraph";
import { feedForToken, fetchSpotUsd1e8, fetchVaas, shouldTrigger } from "./pyth";
import { executePolicy } from "./executor";
import { keeperX402 } from "./x402";

const secrets = loadSecrets();
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mcp: mcpHint(secrets.graphUrl),
    keyRing: ringStatus(secrets),
    network: secrets.hederaNetwork,
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
      if (!trigger) continue;

      const vaas = await fetchVaas(feed);
      const tx = await executePolicy({
        rpc: secrets.baseRpc,
        sessionKey: secrets.sessionKey,
        manager: secrets.manager,
        policyId: pol.id,
        vaas,
      });
      hits.push({ policyId: pol.id, trigger, tx });
    }

    res.json({
      evaluated: policies.length,
      executed: hits,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const port = Number(process.env.KEEPER_PORT ?? 3001);
app.listen(port, () => {
  const kr = ringStatus(secrets);
  console.log(`[lga] keeper :${port}  POST /trigger is x402-gated`);
  console.log(`[lga] Key Ring: ${kr.source} headless=${kr.headless}`);
});
