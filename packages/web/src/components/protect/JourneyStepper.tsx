"use client";

import type { JourneyStage } from "@/components/ProtectionProvider";

const STEPS: { id: JourneyStage; label: string }[] = [
  { id: "device", label: "Device" },
  { id: "asset", label: "Asset" },
  { id: "strategy", label: "Strategy" },
  { id: "limits", label: "Limits" },
  { id: "review", label: "Review" },
  { id: "signing", label: "Sign" },
  { id: "monitor", label: "Watch" },
  { id: "outcome", label: "Outcome" },
];

const ORDER = STEPS.map((s) => s.id);

export function JourneyStepper({
  stage,
  onJump,
}: {
  stage: JourneyStage;
  onJump?: (s: JourneyStage) => void;
}) {
  const idx = ORDER.indexOf(stage === "kill" ? "outcome" : stage);

  return (
    <ol
      className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-line pb-5"
      aria-label="Protection journey stages"
    >
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.id}>
            <button
              type="button"
              disabled={!onJump || i > idx}
              onClick={() => onJump?.(s.id)}
              className={
                active
                  ? "font-mono text-xs tracking-[0.14em] text-signal"
                  : done
                    ? "font-mono text-xs tracking-[0.14em] text-paper/70 hover:text-paper"
                    : "font-mono text-xs tracking-[0.14em] text-mute/50 disabled:cursor-default"
              }
              aria-current={active ? "step" : undefined}
            >
              <span className="text-mute">{String(i + 1).padStart(2, "0")}</span>{" "}
              {s.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
