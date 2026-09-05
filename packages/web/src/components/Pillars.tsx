const pillars = [
  {
    title: "Key Ring secrets",
    body: "Keeper loads session keys and API creds via wallet-cli ring on a headless host — not a plaintext .env.",
  },
  {
    title: "Pyth + Uniswap fill",
    body: "On-chain price VAAs gate executePolicy. Swaps exit to USDC on Base through Uniswap v3.",
  },
  {
    title: "Subgraph MCP",
    body: "The agent treats Receipt Graph as the source of active policies — automation, not a static printout.",
  },
];

export function Pillars() {
  return (
    <section id="pillars" className="border-t border-line px-5 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-mute">Pillars</p>
        <h2 className="mt-4 max-w-xl font-display text-3xl font-semibold tracking-tight text-paper md:text-4xl">
          Built for three sponsor tracks. One demo.
        </h2>
        <div className="mt-16 space-y-16">
          {pillars.map((p, i) => (
            <div
              key={p.title}
              className="grid gap-4 border-b border-line pb-12 md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:gap-12"
            >
              <h3 className="font-display text-2xl text-paper md:text-3xl">
                <span className="mr-3 font-mono text-base text-signal">0{i + 1}</span>
                {p.title}
              </h3>
              <p className="max-w-lg text-base leading-relaxed text-mute md:pt-1">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
