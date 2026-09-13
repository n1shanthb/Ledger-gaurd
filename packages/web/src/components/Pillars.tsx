const pillars = [
  {
    title: "Hardware bounds",
    body: "You clear-sign amount and price bands on Ledger OLED. Master key never leaves the device; Key Ring holds keeper secrets — not the chat model.",
  },
  {
    title: "Autonomous watch",
    body: "Composer, Clerk, and Solver advise; Payer, Autopilot, and Driver are code. They pay x402, read live Graph + Pyth, and fill only inside your signed limits.",
  },
  {
    title: "Graph-backed proof",
    body: "Receipt Graph is load-bearing: active policies for the keeper, execution receipts and kills for Activity, payment audits with HCS refs, plus Messari lending/DEX fan-out for risk gates — not a receipt dump.",
  },
];

export function Pillars() {
  return (
    <section id="pillars" className="border-t border-line px-5 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-mute">
          Why it matters
        </p>
        <h2 className="mt-4 max-w-xl font-display text-3xl font-semibold tracking-tight text-paper md:text-4xl">
          Bounds on device. Automation in the keeper. Proof on Graph.
        </h2>
        <div className="mt-16 space-y-16">
          {pillars.map((p, i) => (
            <div
              key={p.title}
              className="grid gap-4 border-b border-line pb-12 md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:gap-12"
            >
              <h3 className="font-display text-2xl text-paper md:text-3xl">
                <span className="mr-3 font-mono text-base text-accent">0{i + 1}</span>
                {p.title}
              </h3>
              <p className="max-w-lg text-base leading-relaxed text-mute md:pt-1">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
