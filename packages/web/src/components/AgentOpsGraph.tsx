"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { GraphState } from "@/lib/agentEvents";
import { deriveScene } from "@/lib/agentScene";

function SceneFallback() {
  return (
    <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
      Loading 3D scene…
    </div>
  );
}

const AgentOpsCanvas = dynamic(
  () =>
    import("@/components/agent3d/AgentOpsCanvas").then((m) => m.AgentOpsCanvas),
  { ssr: false, loading: () => <SceneFallback /> },
);

export function AgentOpsGraph({ graph }: { graph: GraphState }) {
  const scene = useMemo(() => deriveScene(graph), [graph]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-agent-hub/25 bg-[#0a1220]"
      suppressHydrationWarning
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agent-hub/80">
          Live ops · 3D · events only
        </p>
        <p className="font-mono text-[9px] text-slate-500">
          drag to orbit · scroll zoom
        </p>
      </div>

      <div
        className="relative h-[min(62vh,560px)] w-full min-h-[320px]"
        suppressHydrationWarning
      >
        <AgentOpsCanvas graph={graph} />
      </div>

      {scene.gate && (
        <p
          className={`relative z-10 border-t border-white/5 px-3 py-2 font-mono text-[11px] ${
            scene.gate.proceed ? "text-emerald-300" : "text-amber-200"
          }`}
        >
          gate {scene.gate.proceed ? "clear" : "warn"}
          {scene.gate.reasons[0] ? ` · ${scene.gate.reasons[0]}` : ""}
        </p>
      )}
    </div>
  );
}
