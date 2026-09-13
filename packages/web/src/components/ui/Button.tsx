import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary:
    "bg-paper text-ink hover:bg-signal disabled:opacity-40",
  success:
    "bg-signal text-ink hover:brightness-110 disabled:opacity-40",
  secondary:
    "border border-mist text-paper hover:border-paper disabled:opacity-40",
  ghost:
    "text-mute hover:text-paper disabled:opacity-40",
  danger:
    "border border-kill/50 text-kill hover:bg-kill/10 disabled:opacity-40",
} as const;

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition duration-base disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
