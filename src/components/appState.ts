export const STORAGE_TEAM_ID = "holdbold-team-id";
export const STORAGE_THEME = "holdbold-theme";

export function getStoredTeamId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_TEAM_ID) ?? "";
}

export function setStoredTeamId(teamId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_TEAM_ID, teamId);
}

export function setStoredTheme(theme: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_THEME, theme);
}

export function getStoredTheme() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_THEME) ?? "";
}
