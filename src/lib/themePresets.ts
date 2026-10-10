// Farveprofiler, som hold og spillere kan vælge imellem (selve farverne ligger i globals.css).
export const THEME_PRESETS = [
  // Lyse temaer: hvid halvdel + accentfarve.
  { id: "atlantic", label: "Atlantic", swatch: "linear-gradient(135deg, #ffffff 55%, #0b84d8 55%)" },
  { id: "forest", label: "Forest", swatch: "linear-gradient(135deg, #ffffff 55%, #15803d 55%)" },
  { id: "crimson", label: "Crimson", swatch: "linear-gradient(135deg, #ffffff 55%, #e11d48 55%)" },
  { id: "berry", label: "Berry", swatch: "linear-gradient(135deg, #ffffff 55%, #a21caf 55%)" },
  { id: "lavender", label: "Lavender", swatch: "linear-gradient(135deg, #ffffff 55%, #7c3aed 55%)" },
  { id: "ocean", label: "Ocean", swatch: "linear-gradient(135deg, #ffffff 55%, #0e7490 55%)" },
  { id: "midnight", label: "Midnight", swatch: "linear-gradient(135deg, #ffffff 55%, #1e2a78 55%)" },
  { id: "slate", label: "Slate", swatch: "linear-gradient(135deg, #ffffff 55%, #475569 55%)" },
  { id: "gold", label: "Gold", swatch: "linear-gradient(135deg, #ffffff 55%, #eab308 55%)" },
  // Mørke temaer: altid mørke, uanset systemets lys/mørk-indstilling.
  { id: "graphite", label: "Graphite", swatch: "linear-gradient(135deg, #1c2128 55%, #2f81f7 55%)" },
  { id: "obsidian", label: "Obsidian", swatch: "linear-gradient(135deg, #000000 55%, #06b6d4 55%)" },
  { id: "nightfall", label: "Nightfall", swatch: "linear-gradient(135deg, #1b1740 55%, #818cf8 55%)" },
  { id: "embers", label: "Embers", swatch: "linear-gradient(135deg, #2a0f0a 55%, #f97316 55%)" },
  { id: "blackgold", label: "Blackgold", swatch: "linear-gradient(135deg, #15110a 55%, #eab308 55%)" }
] as const;

export type ThemePresetId = (typeof THEME_PRESETS)[number]["id"];
