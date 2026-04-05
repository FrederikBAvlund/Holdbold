import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Holdbold",
    short_name: "Holdbold",
    description: "Holdets kalender, tilmelding og bødekasse i ét system.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#d90429",
    lang: "da",
    icons: [
      {
        src: "/brand/holdbold-mark-ball.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
