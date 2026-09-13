import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#05070a",
        paper: "#eef2e6",
        mute: "#8a9388",
        line: "#1c242c",
        panel: "#0a0e12",
        panel2: "#10161c",
        mist: "#2a3338",
        // brand / confirmed
        signal: "#a3e635",
        accent: "#a3e635",
        // tech secondary (agents / ops)
        cyan: "#5eead4",
        warn: "#e8b84a",
        kill: "#f07167",
        "agent-graph": "#34d399",
        "agent-oracle": "#a78bfa",
        "agent-broker": "#fb923c",
        "agent-hub": "#a3e635",
        "agent-autopilot": "#2dd4bf",
        "agent-driver": "#5eead4",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        grain: {
          "0%, 100%": { transform: "translate(0,0)" },
          "50%": { transform: "translate(-1%, 1%)" },
        },
        sweep: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        rise: "rise 0.8s ease-out both",
        "rise-delay": "rise 0.8s ease-out 0.15s both",
        "rise-late": "rise 0.8s ease-out 0.3s both",
        grain: "grain 8s ease-in-out infinite",
        sweep: "sweep 6s linear infinite",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      transitionDuration: {
        fast: "150ms",
        base: "220ms",
        slow: "300ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
