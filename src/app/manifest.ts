import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Holdbold",
    short_name: "Holdbold",
    description: "Holdets kalender, tilmelding og bødekasse i ét system.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#121519",
    theme_color: "#121519",
    lang: "da",
    icons: [
      {
        src: "/icon?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/maskable-icon?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/apple-icon?v=2",
        sizes: "180x180",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
