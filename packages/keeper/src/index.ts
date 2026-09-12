import express from "express";
import { loadSecrets, ringStatus } from "./ring";
import { createCapabilityBroker } from "./capabilities";
import { fetchActivePolicies, mcpHint } from "./subgraph";
import { runCycle } from "./cycle";
import { keeperX402 } from "./x402";
import { newAttemptId, recentPayments, recordPayment } from "./payments";
import { hashscanFromPayment } from "./paidTrigger";
import { submitHcsMemo, hcsHashscanUrl } from "./hcsAudit";
import { recordOnChainPaymentAudit } from "./paymentAuditTx";
import { agentChat } from "./agent/chat";
import type { AgentEvent } from "./agent/types";
import { startPayOnHit } from "./payOnHit";
import { confirmPolicyProposals } from "./agent/proposeConfirm";
import { draftIsReady, parsePolicyDraft, type PolicyDraft } from "./agent/policyDraft";
import { randomUUID } from "node:crypto";

const secrets = loadSecrets();
const app = express();
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, authorization, accept",
  );
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

let lastPoll: {
  at: number;
  evaluated: number;
  executed: number;
} | null = null;
let pollBusy = false;

async function pollOnce() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const r = await Promise.race([
      runCycle(secrets, { execute: true }),
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

async function handlePaidCycle(
  req: express.Request,
  res: express.Response,
  path: "trigger" | "quote",
) {
  const attemptId = newAttemptId();
  const execute = path === "trigger";
  try {
    if (execute) {
      console.log("[lga] Driver /trigger paid cycle starting");
    }
    const r = await runCycle(secrets, { execute });
    const paymentResponse =
      (req.headers["payment-response"] as string | undefined) ??
      (req.headers["PAYMENT-RESPONSE"] as string | undefined) ??
      null;
    const hashscanUrl = hashscanFromPayment(secrets.hederaNetwork, paymentResponse);
    let hcsRef: string | null = null;
    if (execute) {
      hcsRef = await submitHcsMemo(secrets, {
        attemptId,
        path,
        executed: r.executed,
        paymentResponse: paymentResponse?.slice(0, 500) ?? null,
      });
      for (const hit of r.executed) {
        if (!hit.tx) continue;
        await recordOnChainPaymentAudit(secrets, {
          attemptId,
          policyId: hit.policyId,
          baseTx: hit.tx,
          hederaPaymentRef: hashscanUrl ?? paymentResponse?.slice(0, 120) ?? "",
          hcsRef: hcsRef ?? "",
        });
      }
    }
    recordPayment({
      attemptId,
      paidAt: Date.now(),
      path,
      evaluated: r.evaluated,
      executed: r.executed,
      paymentResponse,
      hashscanUrl,
      hcsRef,
      note: r.note,
    });
    res.json({
      attemptId,
      ...r,
      hashscanUrl,
      hcsRef,
      hcsTopicUrl: hcsHashscanUrl(secrets.hederaNetwork, hcsRef),
      mcp: mcpHint(secrets.graphUrl),
    });
  } catch (err) {
    res.status(500).json({ error: String(err), attemptId });
  }
}

app.get("/health", (_req, res) => {
  const pollMs = Number(process.env.POLL_MS ?? 0);
  const broker = createCapabilityBroker(secrets);
  res.json({
    ok: true,
    mcp: mcpHint(secrets.graphUrl),
    keyRing: ringStatus(secrets),
    capabilityBroker: broker.status(),
    network: secrets.hederaNetwork,
    openRouter: Boolean(secrets.openRouterApiKey),
    openRouterModels: secrets.openRouterModels,
    poll: {
      ms: pollMs,
      mode: pollMs > 0 ? "dev_autopoll" : "x402_only",
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

app.get("/payments/recent", (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  res.json({ payments: recentPayments(limit) });
});

app.post("/agent/chat", async (req, res) => {
  try {
    const messages = (req.body?.messages ?? []) as {
      role: "user" | "assistant";
      content: string;
    }[];
    if (!messages.length) {
      res.status(400).json({ error: "messages required" });
      return;
    }
    const out = await agentChat(secrets, messages);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/agent/run", async (req, res) => {
  const messages = (req.body?.messages ?? []) as {
    role: "user" | "assistant";
    content: string;
  }[];
  if (!messages.length) {
    res.status(400).json({ error: "messages required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (ev: AgentEvent) => {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };

  try {
    await agentChat(secrets, messages, send);
  } catch (err) {
    send({
      type: "error",
      runId: "err",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    res.end();
  }
});

/** Confirm edited policy draft → HITL propose (no x402). */
app.post("/agent/propose", async (req, res) => {
  try {
    const body = req.body as {
      draft?: PolicyDraft;
      includeAddons?: boolean;
    };
    if (!body.draft?.primary) {
      res.status(400).json({ error: "draft.primary required" });
      return;
    }
    const draft = parsePolicyDraft(JSON.stringify(body.draft));
    if (!draftIsReady(draft)) {
      res.status(400).json({
        error: "amount and trigger band (stop or take/buy USD) required before propose",
      });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const runId = randomUUID().slice(0, 8);
    const send = (ev: AgentEvent) => {
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    };
    send({ type: "run_start", runId });
    const { text } = await confirmPolicyProposals({
      secrets,
      draft,
      includeAddons: Boolean(body.includeAddons),
      emit: send,
      runId,
    });
    send({ type: "run_end", runId, reply: text });
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: String(err) });
      return;
    }
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        runId: "err",
        message: err instanceof Error ? err.message : String(err),
      })}\n\n`,
    );
    res.end();
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
    quoteAmount: secrets.quoteAmount,
    network: secrets.hederaNetwork,
  }),
);

app.post("/trigger", async (req, res) => {
  await handlePaidCycle(req, res, "trigger");
});

app.post("/quote", async (req, res) => {
  await handlePaidCycle(req, res, "quote");
});

const port = Number(process.env.KEEPER_PORT ?? process.env.PORT ?? 3001);
const pollMs = Number(process.env.POLL_MS ?? 0);

app.listen(port, () => {
  const kr = ringStatus(secrets);
  console.log(`[lga] keeper :${port}  POST /trigger + /quote are x402-gated`);
  console.log(`[lga] Key Ring: ${kr.source} headless=${kr.headless}`);
  console.log(`[lga] OpenRouter: ${secrets.openRouterApiKey ? "enrolled" : "missing"}`);
  if (pollMs > 0) {
    console.log(`[lga] DEV autopoll every ${pollMs}ms (prize mode: POLL_MS=0)`);
    void pollOnce();
    setInterval(() => void pollOnce(), pollMs);
  } else {
    console.log("[lga] autopoll off — execution only via paid POST /trigger (or pay-on-hit)");
  }
  // Same process watcher — one Railway service, stretches free credit
  if (process.env.PAY_ON_HIT === "1" || process.env.PAY_ON_HIT === "true") {
    console.log("[lga] Autopilot pay-on-hit enabled (PAY_ON_HIT=1)");
    startPayOnHit(secrets);
  }
});
