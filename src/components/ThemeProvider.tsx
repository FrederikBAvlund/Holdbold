"use client";

import { useEffect } from "react";
import { getStoredTeamId, getStoredTheme, setStoredTheme } from "@/components/appState";

const DEFAULT_THEME = "atlantic";

export function ThemeProvider() {
  useEffect(() => {
    async function applyTheme() {
      const storedTheme = getStoredTheme();
      if (storedTheme) {
        document.documentElement.dataset.theme = storedTheme;
      }

      const teamId = getStoredTeamId();
      if (!teamId) return;

      const response = await fetch(`/api/team/${teamId}`);
      if (!response.ok) return;
      const data = await response.json();
      const theme = data.team?.themePreset ?? DEFAULT_THEME;
      document.documentElement.dataset.theme = theme;
      setStoredTheme(theme);
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
