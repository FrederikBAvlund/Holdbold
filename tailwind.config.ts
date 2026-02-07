import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        clay: "var(--color-clay)",
        moss: "var(--color-moss)",
        ember: "var(--color-ember)",
        fog: "var(--color-fog)"
      }
    }
  },
  plugins: []
} satisfies Config;
