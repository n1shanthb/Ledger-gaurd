"use client";

import type { JourneyStage } from "@/components/ProtectionProvider";
import type { AgentId, GraphState } from "@/lib/agentEvents";

const ROLES: {
  id: AgentId;
  title: string;
  kind: "ai" | "worker";
  stages: JourneyStage[];
}[] = [
  { id: "clerk", title: "Clerk", kind: "ai", stages: ["device", "asset", "outcome"] },
  { id: "composer", title: "Composer", kind: "ai", stages: ["strategy", "limits"] },
  { id: "solver", title: "Solver", kind: "ai", stages: ["review", "limits"] },
  { id: "payer", title: "Payer", kind: "worker", stages: ["monitor", "outcome"] },
  { id: "autopilot", title: "Autopilot", kind: "worker", stages: ["monitor", "signing"] },
  { id: "driver", title: "Driver", kind: "worker", stages: ["outcome", "monitor"] },
];

const HINT: Partial<Record<JourneyStage, Partial<Record<AgentId, string>>>> = {
  device: { clerk: "Holdings index after you connect and read balances." },
  asset: { clerk: "Pick an asset with a live Pyth spot when available." },
  strategy: { composer: "Stop-loss, take-profit, or buy-dip." },
  limits: {
    composer: "Amount and threshold — demo presets stay labeled.",
    solver: "Tighter bands fire sooner; leave gas.",
  },
  review: { solver: "Session key moves only what you clear-sign." },
  signing: { autopilot: "Confirm OLED rows. Master key never leaves Ledger." },
  monitor: {
    autopilot: "Safe to unplug while watching.",
    payer: "Paid attempt ≠ fill.",
  },
  outcome: {
    driver: "Reports only actual /trigger results.",
    clerk: "Graph may lag a few blocks.",
  },
  kill: { clerk: "Stops all protections after clear-sign." },
};

function nodeState(graph: GraphState | null, id: AgentId) {
  return graph?.nodes[id]?.state ?? "idle";
}

function lastMsg(graph: GraphState | null, id: AgentId) {
  return graph?.nodes[id]?.last;
}

export function AgentCompanionRail({
  stage,
  graph,
  compact,
  onAsk,
}: {
  stage: JourneyStage;
  graph?: GraphState | null;
  compact?: boolean;
  onAsk?: (prompt: string) => void;
}) {
  return (
    <aside
      className={compact ? "space-y-2" : "border-t border-line pt-5"}
      aria-label="Agent companions"
    >
      {!compact && (
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
          Companions
        </p>
      )}
      <ul className="mt-4 grid gap-0 divide-y divide-line border-y border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3 xl:grid-cols-6">
        {ROLES.map((r) => {
          const relevant = r.stages.includes(stage);
          const state = nodeState(graph ?? null, r.id);
          const live = lastMsg(graph ?? null, r.id);
          const hint = HINT[stage]?.[r.id];
          return (
            <li
              key={r.id}
              className={`px-3 py-4 transition ${relevant ? "bg-signal/[0.03]" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-sm ${relevant ? "text-paper" : "text-mute"}`}
                >
                  {r.title}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-mute/70">
                  {r.kind === "ai" ? "ai" : "job"}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-mute">
                {state}
              </p>
              <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-mute">
                {live || hint || "Standing by."}
              </p>
              {relevant && onAsk && (
                <button
                  type="button"
                  className="mt-3 font-mono text-[10px] uppercase tracking-wider text-signal hover:underline"
                  onClick={() =>
                    onAsk(
                      `As ${r.title}, briefly advise on the ${stage} step of my protection.`,
                    )
                  }
                >
                  Ask →
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
