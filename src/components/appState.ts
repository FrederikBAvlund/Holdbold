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

/** Lader ikon- og manifest-adresserne følge temaet, så "Føj til hjemmeskærm" bruger temaets farver. */
function syncInstallIcons(theme: string) {
  const retarget = (link: Element, param: string) => {
    const href = link.getAttribute("href");
    if (!href) return;
    const base = href.split(/[?&]theme=/)[0];
    link.setAttribute("href", `${base}${base.includes("?") ? "&" : "?"}${param}=${encodeURIComponent(theme)}`);
  };
  document.querySelectorAll('link[rel="manifest"], link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((link) =>
    retarget(link, "theme")
  );
}

export function setStoredTheme(theme: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_THEME, theme);
  syncInstallIcons(theme);
}

export function getStoredTheme() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_THEME) ?? "";
}

/** Fjerner det gemte tema, så næste bruger ikke starter med forrige brugers farver. */
export function clearStoredTheme() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_THEME);
}
