"use client";

import { useEffect } from "react";

function readCssVar(name: string) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function applyThemeColor(value: string) {
  if (!value) return;
  // Layoutet har én theme-color pr. systemtilstand; et mørkt tema skal vinde i begge.
  let metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
    metas = [meta];
  }
  for (const meta of metas) {
    meta.removeAttribute("media");
    meta.setAttribute("content", value);
  }
}

function resolveBackgroundHex() {
  // --bg er afledt via color-mix, så farven omsættes til hex via et canvas.
  const probe = document.createElement("div");
  probe.style.backgroundColor = "var(--bg)";
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = computed;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function ThemeColorMeta() {
  useEffect(() => {
    function sync() {
      try {
        applyThemeColor(resolveBackgroundHex() || readCssVar("--color-moss") || "#f4f6fa");
      } catch {
        applyThemeColor("#f4f6fa");
      }
    }

    sync();

    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "style"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
    };
  }, []);

  return null;
}
