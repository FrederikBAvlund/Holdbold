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
  { id: "mono", label: "Mono", swatch: "#334155" },
  // Mørke temaer: altid mørke, uanset systemets lys/mørk-indstilling.
  { id: "graphite", label: "Graphite", swatch: "linear-gradient(135deg, #1c2128 55%, #2f81f7 55%)" },
  { id: "obsidian", label: "Obsidian", swatch: "linear-gradient(135deg, #000000 55%, #06b6d4 55%)" },
  { id: "nightfall", label: "Nightfall", swatch: "linear-gradient(135deg, #1b1740 55%, #818cf8 55%)" },
  { id: "embers", label: "Embers", swatch: "linear-gradient(135deg, #2a0f0a 55%, #f97316 55%)" }
] as const;

export type ThemePresetId = (typeof THEME_PRESETS)[number]["id"];
