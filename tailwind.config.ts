import type { Config } from "tailwindcss";

// CSS-variabel-farver understøtter ikke Tailwinds opacity-modifier (fx text-ink/70) af sig selv.
// color-mix med <alpha-value> gør, at både `text-ink` og `text-ink/70` virker.
const withAlpha = (cssVar: string) =>
  `color-mix(in srgb, var(${cssVar}) calc(<alpha-value> * 100%), transparent)`;

export default {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"]
      },
      colors: {
        ink: withAlpha("--ink"),
        clay: withAlpha("--color-clay"),
        moss: withAlpha("--moss"),
        ember: withAlpha("--ember"),
        fog: withAlpha("--fog"),
        bg: withAlpha("--bg"),
        line: withAlpha("--line"),
        surface: withAlpha("--surface"),
        "surface-2": withAlpha("--surface-2"),
        primary: withAlpha("--primary"),
        "on-primary": withAlpha("--on-primary"),
        "on-solid": withAlpha("--on-solid"),
        success: withAlpha("--success"),
        warning: withAlpha("--warning"),
        danger: withAlpha("--danger"),
        in: withAlpha("--in"),
        out: withAlpha("--out"),
        pending: withAlpha("--pending"),
        "kind-match": withAlpha("--kind-match"),
        "kind-training": withAlpha("--kind-training")
      },
      opacity: {
        "8": "0.08",
        "12": "0.12",
        "15": "0.15",
        "85": "0.85"
      },
      borderRadius: {
        app: "var(--radius-card)",
        "app-soft": "var(--radius-card-soft)",
        control: "var(--radius-control)"
      },
      spacing: {
        "nav-pad": "calc(6rem + env(safe-area-inset-bottom, 0px))",
        "safe-top": "env(safe-area-inset-top, 0px)"
      },
      fontSize: {
        "nav-label": ["0.6875rem", { lineHeight: "1.1", fontWeight: "600" }]
      },
      keyframes: {},
      animation: {
        "sheet-up": "sheet-up 260ms cubic-bezier(0.2, 0.9, 0.3, 1)",
        "fade-in": "fade-in 180ms ease-out",
        "pop-in": "pop-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1)"
      }
    }
  },
  plugins: []
} satisfies Config;
