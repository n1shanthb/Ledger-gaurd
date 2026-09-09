"use client";

import type { AgentId, GraphState, NodeState } from "@/lib/agentEvents";

const LAYOUT: Record<AgentId, { x: number; y: number; title: string }> = {
  coordinator: { x: 45.5, y: 8, title: "Coordinator" },
  sentinel: { x: 8, y: 52, title: "Sentinel" },
  oracle: { x: 45.5, y: 58, title: "Oracle" },
  broker: { x: 78, y: 52, title: "Broker" },
};

const EDGE_PTS: Record<string, { x1: number; y1: number; x2: number; y2: number }> = {
  "coordinator-sentinel": { x1: 50, y1: 22, x2: 18, y2: 52 },
  "coordinator-oracle": { x1: 50, y1: 22, x2: 50, y2: 58 },
  "coordinator-broker": { x1: 50, y1: 22, x2: 82, y2: 52 },
  "sentinel-oracle": { x1: 18, y1: 62, x2: 45, y2: 68 },
  "oracle-broker": { x1: 55, y1: 68, x2: 78, y2: 62 },
  "sentinel-broker": { x1: 18, y1: 62, x2: 78, y2: 62 },
};

function nodeClass(state: NodeState) {
  if (state === "active") return "border-signal bg-signal/15 text-paper";
  if (state === "tool")
    return "border-signal bg-signal/25 text-paper shadow-[0_0_24px_rgba(94,234,212,0.25)]";
  if (state === "done")
    return "border-emerald-700/60 bg-emerald-950/40 text-paper";
  if (state === "error") return "border-kill/60 bg-kill/10 text-kill";
  return "border-line bg-panel/40 text-mute";
}

function edgeKey(from: AgentId, to: AgentId) {
  return `${from}-${to}`;
}

export function AgentOpsGraph({ graph }: { graph: GraphState }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-ink/50 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
        Live ops · events only
      </p>
      <div
        className="relative mx-auto aspect-[11/7] w-full max-w-lg"
        style={{ perspective: "900px" }}
      >
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          {graph.edges.map((e, i) => {
            const pts =
              EDGE_PTS[edgeKey(e.from, e.to)] ??
              EDGE_PTS[edgeKey(e.to, e.from)] ?? {
                x1: 50,
                y1: 30,
                x2: 50,
                y2: 70,
              };
            return (
              <g key={`${e.from}-${e.to}-${i}`}>
                <line
                  x1={pts.x1}
                  y1={pts.y1}
                  x2={pts.x2}
                  y2={pts.y2}
                  stroke={e.live ? "#5eead4" : "#3f3f46"}
                  strokeWidth={e.live ? 0.6 : 0.35}
                  strokeDasharray={e.live ? "2 1.5" : "1 2"}
                  style={
                    e.live
                      ? { animation: "lga-dash 0.7s linear infinite" }
                      : undefined
                  }
                />
              </g>
            );
          })}
        </svg>

        {(Object.keys(LAYOUT) as AgentId[]).map((id) => {
          const pos = LAYOUT[id];
          const n = graph.nodes[id];
          const liveEdge = graph.edges.find(
            (e) => (e.from === id || e.to === id) && e.live,
          );
          return (
            <div
              key={id}
              className={`absolute w-[22%] min-w-[4.5rem] -translate-x-1/2 rounded-lg border px-2 py-2 text-center transition duration-300 ${nodeClass(n.state)}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform:
                  n.state === "tool" || n.state === "active"
                    ? "translateX(-50%) rotateX(10deg) rotateY(-8deg)"
                    : "translateX(-50%) rotateX(4deg)",
                transformStyle: "preserve-3d",
              }}
            >
              <p className="font-display text-[11px] leading-tight sm:text-xs">
                {pos.title}
              </p>
              <p className="mt-0.5 font-mono text-[8px] uppercase opacity-80">
                {n.state}
              </p>
              {n.model && (
                <p
                  className="mt-1 truncate font-mono text-[7px] opacity-70"
                  title={n.model}
                >
                  {n.model.split("/").pop()}
                </p>
              )}
              {(liveEdge?.label || n.last) && (
                <p className="mt-1 line-clamp-2 font-mono text-[7px] opacity-80">
                  {liveEdge?.label ?? n.last}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {graph.gate && (
        <p
          className={`mt-3 font-mono text-[11px] ${
            graph.gate.proceed ? "text-emerald-300" : "text-amber-200"
          }`}
        >
          gate {graph.gate.proceed ? "clear" : "warn"}
          {graph.gate.reasons[0] ? ` · ${graph.gate.reasons[0]}` : ""}
        </p>
      )}
    </div>
  );
}
