import type { ReactNode } from "react";

/** Section surface — hairline, not a floating SaaS card. */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-t border-line pt-6 ${className}`}>{children}</div>
  );
}

export function StatusBanner({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "success" | "warn" | "danger" | "accent";
  title: string;
  children?: ReactNode;
}) {
  const bar = {
    neutral: "border-line",
    success: "border-signal/40",
    warn: "border-warn/40",
    danger: "border-kill/40",
    accent: "border-signal/40",
  } as const;
  const titleColor = {
    neutral: "text-paper",
    success: "text-signal",
    warn: "text-warn",
    danger: "text-kill",
    accent: "text-signal",
  } as const;

  return (
    <div className={`border-l-2 ${bar[tone]} bg-panel/40 py-4 pl-4 pr-3`} role="status">
      <p className={`font-display text-lg tracking-tight ${titleColor[tone]}`}>
        {title}
      </p>
      {children && <div className="mt-1 text-sm leading-relaxed text-mute">{children}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-t border-line py-12">
      <p className="font-display text-2xl tracking-tight text-paper">{title}</p>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-mute">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-mist/30 ${className}`} aria-hidden />
  );
}
