// Dansk dato-/tidsformatering samlet ét sted.

const TZ_LOCALE = "da-DK";

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function dayDiff(value: string | Date, now = new Date()) {
  const ms = startOfDay(toDate(value)).getTime() - startOfDay(now).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatTime(value: string | Date) {
  return toDate(value).toLocaleTimeString(TZ_LOCALE, { hour: "2-digit", minute: "2-digit" });
}

/** "I dag", "I morgen", "I går", ellers "tirsdag 14. okt." */
export function formatDayLabel(value: string | Date, now = new Date()) {
  const diff = dayDiff(value, now);
  if (diff === 0) return "I dag";
  if (diff === 1) return "I morgen";
  if (diff === -1) return "I går";
  const date = toDate(value);
  const label = date.toLocaleDateString(TZ_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {})
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "I morgen kl. 18:30" */
export function formatDayTime(value: string | Date, now = new Date()) {
  return `${formatDayLabel(value, now)} kl. ${formatTime(value)}`;
}

export function formatWeekdayShort(value: string | Date) {
  return toDate(value).toLocaleDateString(TZ_LOCALE, { weekday: "short" }).replace(".", "");
}

export function formatMonthShort(value: string | Date) {
  return toDate(value).toLocaleDateString(TZ_LOCALE, { month: "short" }).replace(".", "");
}

export function formatMonthYear(value: string | Date) {
  const label = toDate(value).toLocaleDateString(TZ_LOCALE, { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Kort nedtælling: "om 3 dage", "om 5 t", "om 20 min", "nu". */
export function formatCountdown(value: string | Date, now = new Date()) {
  const ms = toDate(value).getTime() - now.getTime();
  if (ms <= 0) return "nu";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `om ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `om ${hours} t`;
  return `om ${dayDiff(value, now)} dage`;
}

/** Relativ fortid: "lige nu", "for 5 min siden", "for 3 t siden", "i går", "12. okt." */
export function formatRelativePast(value: string | Date, now = new Date()) {
  const ms = now.getTime() - toDate(value).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "lige nu";
  if (minutes < 60) return `for ${minutes} min siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24 && dayDiff(value, now) === 0) return `for ${hours} t siden`;
  if (dayDiff(value, now) === -1) return `i går kl. ${formatTime(value)}`;
  return toDate(value).toLocaleDateString(TZ_LOCALE, { day: "numeric", month: "short" });
}

export function formatKr(amount: number) {
  return `${amount.toLocaleString(TZ_LOCALE)} kr`;
}

export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
