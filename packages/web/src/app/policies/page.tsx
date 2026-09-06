import Link from "next/link";
import { PoliciesExplorer } from "@/components/PoliciesExplorer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { STUDIO_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default function PoliciesPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-ink pt-24">
        <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal">
            Policies
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper md:text-5xl">
            Policy board
          </h1>
          <p className="mt-4 max-w-2xl text-mute">
            Active and inactive Guardian policies from Receipt Graph. Select one to
            see floors / targets against live Pyth on the chart.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs text-mute">
            <Link
              href="/console"
              className="rounded-full border border-mist px-3 py-1.5 hover:border-signal hover:text-signal"
            >
              ← Console
            </Link>
            <a
              href={STUDIO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-mist px-3 py-1.5 hover:border-signal hover:text-signal"
            >
              Studio →
            </a>
          </div>

          <PoliciesExplorer />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
