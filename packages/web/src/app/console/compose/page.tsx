import { ComposeProof } from "@/components/ComposeProof";
import { ConsoleNav } from "@/components/ConsoleNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function ComposePage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-ink pt-24">
        <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">
            Compose
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper md:text-5xl">
            Decisions
          </h1>
          <p className="mt-4 max-w-2xl text-mute">
            One Messari query → N protocols → safest borrow, deepest WETH, swap
            gate. Same shape the keeper agent uses.
          </p>
          <ConsoleNav />
          <ComposeProof />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
