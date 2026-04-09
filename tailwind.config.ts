import type { Config } from "tailwindcss";

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
        ink: "var(--color-ink)",
        clay: "var(--color-clay)",
        moss: "var(--color-moss)",
        ember: "var(--color-ember)",
        fog: "var(--color-fog)"
      },
      borderRadius: {
        app: "var(--radius-card)",
        "app-soft": "var(--radius-card-soft)",
        control: "var(--radius-control)"
      },
      spacing: {
        "nav-pad": "calc(7.25rem + env(safe-area-inset-bottom, 0px))",
        "safe-top": "env(safe-area-inset-top, 0px)"
      },
      fontSize: {
        "nav-label": ["0.625rem", { lineHeight: "1.1", fontWeight: "600" }]
      }
    }
  },
  plugins: []
} satisfies Config;
