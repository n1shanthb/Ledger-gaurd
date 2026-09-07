import { paymentMiddleware } from "@x402/express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";

export function keeperX402(opts: {
  facilitator: string;
  payTo: string;
  amount?: string;
  quoteAmount?: string;
  network: "hedera:mainnet" | "hedera:testnet";
}) {
  const facilitator = new HTTPFacilitatorClient({ url: opts.facilitator });
  const server = new x402ResourceServer(facilitator).register(
    "hedera:*",
    new ExactHederaScheme({}),
  );

  const amount = opts.amount ?? "100000";
  const quoteAmount = opts.quoteAmount ?? "10000";

  return paymentMiddleware(
    {
      "POST /trigger": {
        accepts: [
          {
            scheme: "exact",
            price: { asset: "0.0.0", amount },
            network: opts.network,
            payTo: opts.payTo,
          },
        ],
        description: "LGA keeper full execution attempt",
        mimeType: "application/json",
      },
      "POST /quote": {
        accepts: [
          {
            scheme: "exact",
            price: { asset: "0.0.0", amount: quoteAmount },
            network: opts.network,
            payTo: opts.payTo,
          },
        ],
        description: "LGA keeper dry-run eval (Graph+Pyth, no execute)",
        mimeType: "application/json",
      },
    },
    server,
  );
}
