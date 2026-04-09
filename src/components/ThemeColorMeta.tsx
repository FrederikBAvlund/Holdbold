"use client";

import { useEffect } from "react";

function readCssVar(name: string) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function applyThemeColor(value: string) {
  if (!value) return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", value);
}

export default function ThemeColorMeta() {
  useEffect(() => {
    function sync() {
      const button = readCssVar("--color-button");
      if (button) {
        applyThemeColor(button);
        return;
      }
      applyThemeColor("#0b84d8");
    }

    sync();

    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "style"] });

    return () => observer.disconnect();
  }, []);

  return null;
}
