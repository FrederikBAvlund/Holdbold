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
        ink: "var(--ink)",
        clay: "var(--color-clay)",
        moss: "var(--moss)",
        ember: "var(--ember)",
        fog: "var(--fog)",
        bg: "var(--bg)",
        line: "var(--line)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        primary: "var(--primary)",
        "on-primary": "var(--on-primary)",
        "on-solid": "var(--on-solid)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)"
      },
      borderRadius: {
        app: "var(--radius-card)",
        "app-soft": "var(--radius-card-soft)",
        control: "var(--radius-control)"
      },
      spacing: {
        "nav-pad": "calc(6.5rem + env(safe-area-inset-bottom, 0px))",
        "safe-top": "env(safe-area-inset-top, 0px)"
      },
      fontSize: {
        "nav-label": ["0.625rem", { lineHeight: "1.1", fontWeight: "600" }]
      }
    }
  },
  plugins: []
} satisfies Config;
