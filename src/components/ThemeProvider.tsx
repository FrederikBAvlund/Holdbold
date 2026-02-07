"use client";

import { useEffect } from "react";
import { getStoredTeamId, getStoredTheme, setStoredTheme } from "@/components/appState";

const DEFAULT_THEME = "atlantic";

type ThemeConfig = {
  ink?: string;
  clay?: string;
  moss?: string;
  ember?: string;
  fog?: string;
  button?: string;
  buttonText?: string;
  gradientStart?: string;
  gradientMid?: string;
  gradientEnd?: string;
};

function applyThemeConfig(config?: ThemeConfig | null) {
  if (!config) return;
  const root = document.documentElement;
  if (config.ink) root.style.setProperty("--color-ink", config.ink);
  if (config.clay) root.style.setProperty("--color-clay", config.clay);
  if (config.moss) root.style.setProperty("--color-moss", config.moss);
  if (config.ember) root.style.setProperty("--color-ember", config.ember);
  if (config.fog) root.style.setProperty("--color-fog", config.fog);
  if (config.button) root.style.setProperty("--color-button", config.button);
  if (config.buttonText) root.style.setProperty("--color-button-text", config.buttonText);
  if (config.gradientStart) root.style.setProperty("--gradient-start", config.gradientStart);
  if (config.gradientMid) root.style.setProperty("--gradient-mid", config.gradientMid);
  if (config.gradientEnd) root.style.setProperty("--gradient-end", config.gradientEnd);
}

export function ThemeProvider() {
  useEffect(() => {
    async function applyTheme() {
      const storedTheme = getStoredTheme();
      if (storedTheme) {
        document.documentElement.dataset.theme = storedTheme;
      }

      let teamId = getStoredTeamId();
      if (!teamId) {
        const meResponse = await fetch("/api/me");
        if (meResponse.ok) {
          const meData = await meResponse.json();
          teamId = meData.memberships?.[0]?.team?.id ?? "";
        }
      }
      if (!teamId) return;

      const response = await fetch(`/api/team/${teamId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const theme = data.team?.themePreset ?? DEFAULT_THEME;
      document.documentElement.dataset.theme = theme;
      setStoredTheme(theme);
      if (theme === "custom") {
        applyThemeConfig(data.team?.themeConfig ?? null);
      }
    }

    applyTheme();
  }, []);

  return null;
}

export function setTheme(theme: string) {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.theme = theme;
  setStoredTheme(theme);
}

export function setCustomTheme(config: ThemeConfig) {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.theme = "custom";
  setStoredTheme("custom");
  applyThemeConfig(config);
}
