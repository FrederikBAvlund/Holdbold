import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Holdbold",
    short_name: "Holdbold",
    description: "Holdets kalender, tilmelding og bødekasse i ét system.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4fbff",
    theme_color: "#0b84d8",
    lang: "da",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
