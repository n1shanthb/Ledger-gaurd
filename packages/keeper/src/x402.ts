import type { Request, Response, NextFunction } from "express";

export type PaymentReq = {
  network: string;
  amount: string;
  facilitator: string;
};

export function x402Gate(reqSpec: PaymentReq) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = (req.header("X-PAYMENT") ?? req.header("PAYMENT-SIGNATURE") ?? "").trim();
    if (!header) {
      res.status(402).json({
        x402Version: 1,
        error: "Payment Required",
        paymentRequirements: {
          network: reqSpec.network,
          amount: reqSpec.amount,
          asset: "HBAR",
          description: "LGA keeper trigger attempt",
          facilitator: reqSpec.facilitator,
        },
      });
      return;
    }

    try {
      const verify = await fetch(`${reqSpec.facilitator.replace(/\/$/, "")}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentHeader: header, paymentRequirements: reqSpec }),
      });
      if (!verify.ok) {
        res.status(402).json({ error: "x402 verify failed", status: verify.status });
        return;
      }
      const settle = await fetch(`${reqSpec.facilitator.replace(/\/$/, "")}/settle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentHeader: header, paymentRequirements: reqSpec }),
      });
      if (!settle.ok) {
        res.status(402).json({ error: "x402 settle failed", status: settle.status });
        return;
      }
      const body = (await settle.json().catch(() => ({}))) as { txHash?: string };
      (req as Request & { x402Tx?: string }).x402Tx = body.txHash;
      next();
    } catch (err) {
      res.status(502).json({ error: String(err) });
    }
  };
}
