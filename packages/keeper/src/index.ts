import express from "express";
import { loadSecrets } from "./ring";
import { fetchActivePolicies, mcpHint } from "./subgraph";
import { feedForToken, fetchSpotUsd1e8, fetchVaas, shouldTrigger } from "./pyth";
import { executePolicy } from "./executor";
import { x402Gate } from "./x402";

const secrets = loadSecrets();
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, mcp: mcpHint(secrets.graphUrl) });
});

app.get("/policies", async (_req, res) => {
  try {
    const policies = await fetchActivePolicies(secrets.graphUrl, secrets.graphApiKey);
    res.json({ policies, mcp: mcpHint(secrets.graphUrl) });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

app.post(
  "/trigger",
  x402Gate({
    network: "hedera:testnet",
    amount: secrets.paymentAmount,
    facilitator: secrets.facilitator,
  }),
  async (req, res) => {
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
        x402Tx: (req as typeof req & { x402Tx?: string }).x402Tx,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

const port = Number(process.env.KEEPER_PORT ?? 3001);
app.listen(port, () => {
  console.log(`[lga] keeper :${port}  POST /trigger is x402-gated`);
});
