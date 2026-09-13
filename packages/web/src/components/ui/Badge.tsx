import type { ReactNode } from "react";

const tones = {
  neutral: "text-mute",
  accent: "text-signal",
  success: "text-signal",
  warn: "text-warn",
  danger: "text-kill",
} as const;

/** Quiet mono label — not a pill chip. */
export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.18em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
