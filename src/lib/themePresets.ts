// Farveprofiler, som hold og spillere kan vælge imellem (selve farverne ligger i globals.css).
export const THEME_PRESETS = [
  { id: "atlantic", label: "Atlantic", swatch: "#0b84d8" },
  { id: "forest", label: "Forest", swatch: "#15803d" },
  { id: "crimson", label: "Crimson", swatch: "#e11d48" },
  { id: "sunset", label: "Sunset", swatch: "#ea580c" },
  { id: "lavender", label: "Lavender", swatch: "#7c3aed" },
  { id: "ocean", label: "Ocean", swatch: "#0e7490" },
  { id: "midnight", label: "Midnight", swatch: "linear-gradient(135deg, #1e2a78 55%, #d4a017 55%)" },
  { id: "neon", label: "Neon", swatch: "#65a30d" },
  { id: "mono", label: "Mono", swatch: "#334155" }
] as const;

export type ThemePresetId = (typeof THEME_PRESETS)[number]["id"];
