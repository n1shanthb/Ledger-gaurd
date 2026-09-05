import { paymentMiddleware } from "@x402/express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";

const HBAR_PRICE = { asset: "0.0.0", amount: "100000" }; // 0.001 HBAR

export function keeperX402(opts: {
  facilitator: string;
  payTo: string;
  amount?: string;
  network: "hedera:mainnet" | "hedera:testnet";
}) {
  const facilitator = new HTTPFacilitatorClient({ url: opts.facilitator });
  const server = new x402ResourceServer(facilitator).register(
    "hedera:*",
    new ExactHederaScheme({}),
  );

  const amount = opts.amount ?? HBAR_PRICE.amount;
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
        description: "LGA keeper trigger attempt",
        mimeType: "application/json",
      },
    },
    server,
  );
}
