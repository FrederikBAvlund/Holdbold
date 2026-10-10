import { NextResponse } from "next/server";
import { resolveThemeId } from "../brand-icon-svg";

/** Manifestet afhænger af ?theme=, så ikonerne får samme farver som det valgte tema, når appen installeres. */
export function GET(request: Request) {
  const theme = resolveThemeId(new URL(request.url).searchParams.get("theme"));
  const query = `?v=2&theme=${theme}`;
  const manifest = {
    name: "Holdbold",
    short_name: "Holdbold",
    description: "Holdets kalender, tilmelding og bødekasse i ét system.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#121519",
    theme_color: "#121519",
    lang: "da",
    icons: [
      { src: `/icon${query}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/maskable-icon${query}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: `/apple-icon${query}`, sizes: "180x180", type: "image/png", purpose: "any" }
    ]
  };
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate"
    }
  });
}
