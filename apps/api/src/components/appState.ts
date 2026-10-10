export const STORAGE_TEAM_ID = "holdbold-team-id";
export const STORAGE_THEME = "holdbold-theme";

/** Dispatched on same-document `setStoredTeamId` so dashboard state stays in sync (e.g. Indstillinger). */
export const TEAM_ID_STORAGE_EVENT = "holdbold-team-id";

export function getStoredTeamId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_TEAM_ID) ?? "";
}

export function setStoredTeamId(teamId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_TEAM_ID, teamId);
  window.dispatchEvent(new CustomEvent(TEAM_ID_STORAGE_EVENT, { detail: teamId }));
}

export function setStoredTheme(theme: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_THEME, theme);
}

export function getStoredTheme() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_THEME) ?? "";
}
