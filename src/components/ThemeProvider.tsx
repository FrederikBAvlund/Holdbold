"use client";

import { useEffect } from "react";
import { getStoredTeamId, getStoredTheme, setStoredTeamId, setStoredTheme } from "@/components/appState";
import { fetchMeCached } from "@/lib/meClientCache";

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

const THEME_CUSTOM_PROPS = [
  "--color-ink",
  "--color-clay",
  "--color-moss",
  "--color-ember",
  "--color-fog",
  "--color-button",
  "--color-button-text",
  "--gradient-start",
  "--gradient-mid",
  "--gradient-end"
] as const;

function clearThemeConfigOverrides() {
  const root = document.documentElement;
  for (const prop of THEME_CUSTOM_PROPS) {
    root.style.removeProperty(prop);
  }
}

function applyThemeConfig(config?: ThemeConfig | null) {
  clearThemeConfigOverrides();
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
        if (storedTheme !== "custom") {
          clearThemeConfigOverrides();
        }
      }

      let teamId = getStoredTeamId();
      const { ok: meOk, data: meData } = await fetchMeCached();
      if (meOk) {
        const userTheme = meData.user?.themePreset as string | null | undefined;
        const userThemeConfig = meData.user?.themeConfig as ThemeConfig | null | undefined;
        if (userTheme) {
          document.documentElement.dataset.theme = userTheme;
          setStoredTheme(userTheme);
          if (userTheme === "custom") {
            applyThemeConfig(userThemeConfig ?? null);
          } else {
            clearThemeConfigOverrides();
          }
          return;
        }

        const memberships = meData.memberships ?? [];
        const firstTeam = memberships[0]?.team?.id ?? "";
        const isCurrentValid = memberships.some((membership) => membership.team?.id === teamId);
        if (!teamId || !isCurrentValid) {
          teamId = firstTeam;
          if (teamId) {
            setStoredTeamId(teamId);
          }
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
      } else {
        clearThemeConfigOverrides();
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
  if (theme !== "custom") {
    clearThemeConfigOverrides();
  }
}

export function setCustomTheme(config: ThemeConfig) {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.theme = "custom";
  setStoredTheme("custom");
  applyThemeConfig(config);
}
