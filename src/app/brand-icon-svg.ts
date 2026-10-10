// App-ikon (H-monogram med bold). Samme motiv og farver som mærket i appen: src/components/ui/BrandMark.tsx.
// Farverne følger temaet: samme regler som --primary / --on-primary i globals.css.
// rounded: favicon og manifest "any" · square: iOS (afrunder selv) · maskable: Android med motiv i safe-zonen.
import { DEFAULT_THEME_ID, THEME_PRESETS } from "@/lib/themePresets";

type ThemeColors = { dark: boolean; ink: string; moss: string; button: string; buttonText: string };

// Rå brand-farver pr. tema (fra globals.css).
const THEME_COLORS: Record<string, ThemeColors> = {
  graphite: { dark: true, ink: "#1c2128", moss: "#2f81f7", button: "#2f6feb", buttonText: "#ffffff" },
  obsidian: { dark: true, ink: "#000000", moss: "#06b6d4", button: "#0e7490", buttonText: "#ffffff" },
  nightfall: { dark: true, ink: "#1b1740", moss: "#818cf8", button: "#4f46e5", buttonText: "#ffffff" },
  embers: { dark: true, ink: "#2a0f0a", moss: "#f97316", button: "#c2410c", buttonText: "#ffffff" },
  blackgold: { dark: true, ink: "#15110a", moss: "#eab308", button: "#eab308", buttonText: "#2b2106" },
  atlantic: { dark: false, ink: "#08213a", moss: "#0b84d8", button: "#0b84d8", buttonText: "#ffffff" },
  forest: { dark: false, ink: "#0f271d", moss: "#15803d", button: "#15803d", buttonText: "#ffffff" },
  crimson: { dark: false, ink: "#2a0a0f", moss: "#e11d48", button: "#e11d48", buttonText: "#ffffff" },
  lavender: { dark: false, ink: "#1e1035", moss: "#7c3aed", button: "#7c3aed", buttonText: "#ffffff" },
  ocean: { dark: false, ink: "#062a30", moss: "#0891b2", button: "#0e7490", buttonText: "#ffffff" },
  midnight: { dark: false, ink: "#0b1430", moss: "#3046b8", button: "#1e2a78", buttonText: "#ffffff" },
  berry: { dark: false, ink: "#2a0a2e", moss: "#a21caf", button: "#a21caf", buttonText: "#ffffff" },
  slate: { dark: false, ink: "#0f1b2d", moss: "#475569", button: "#334155", buttonText: "#ffffff" },
  gold: { dark: false, ink: "#2b2106", moss: "#a16207", button: "#eab308", buttonText: "#2b2106" }
};

export function resolveThemeId(value: string | null | undefined): string {
  return THEME_PRESETS.some((preset) => preset.id === value) && value ? value : DEFAULT_THEME_ID;
}

function mix(hex: string, other: number, weight: number): string {
  const channel = (offset: number) => {
    const base = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(base * weight + other * (1 - weight))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Flade- og motivfarve for et tema (som --primary / --on-primary i appen). */
export function brandIconColors(themeId?: string | null): { tile: string; ink: string } {
  const theme = THEME_COLORS[resolveThemeId(themeId)];
  if (theme.dark) return { tile: mix(theme.moss, 255, 0.68), ink: mix(theme.ink, 0, 0.8) };
  return { tile: theme.button, ink: theme.buttonText };
}

function build({ radius, scale }: { radius: number; scale: number }, themeId?: string | null): string {
  const { tile, ink } = brandIconColors(themeId);
  const offset = (1024 * (1 - scale)) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
    `<rect width="1024" height="1024" rx="${radius}" fill="${tile}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${scale})">` +
    `<g transform="skewX(-12) translate(104 0)" fill="${ink}">` +
    `<rect x="250" y="220" width="160" height="584" rx="34"/>` +
    `<rect x="614" y="220" width="160" height="584" rx="34"/>` +
    `<rect x="380" y="462" width="264" height="100"/></g>` +
    `<circle cx="512" cy="512" r="176" fill="${tile}"/>` +
    `<circle cx="512" cy="512" r="140" fill="${ink}"/>` +
    `<g stroke="${tile}" stroke-width="18" stroke-linecap="round">` +
    `<line x1="512" y1="462" x2="512" y2="383"/><line x1="560" y1="496" x2="634" y2="472"/>` +
    `<line x1="542" y1="553" x2="588" y2="616"/><line x1="482" y1="553" x2="436" y2="616"/>` +
    `<line x1="464" y1="496" x2="390" y2="472"/></g>` +
    `<polygon points="512,462 560,496 542,553 482,553 464,496" fill="${tile}" stroke="${tile}" stroke-width="14" stroke-linejoin="round"/>` +
    `</g></svg>`
  );
}

export const brandIconSvg = (themeId?: string | null) => build({ radius: 232, scale: 1 }, themeId);
export const brandIconSvgSquare = (themeId?: string | null) => build({ radius: 0, scale: 1 }, themeId);
export const brandIconSvgMaskable = (themeId?: string | null) => build({ radius: 0, scale: 0.8 }, themeId);
