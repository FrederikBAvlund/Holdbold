export type IcsEvent = {
  uid: string;
  title: string;
  start: Date;
  /** Standard: 90 min for træning, 120 min for kamp */
  durationMinutes: number;
  location?: string | null;
  description?: string | null;
  canceled?: boolean;
  /** Sidst ændret – bruges som DTSTAMP */
  updatedAt?: Date;
};

export function defaultDurationMinutes(kind: string | null | undefined) {
  return kind === "MATCH" ? 120 : 90;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** UTC-format efter RFC 5545: 20261010T183000Z */
export function formatIcsDate(date: Date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Linjer må højst være 75 oktetter; fortsættelseslinjer starter med et mellemrum. */
export function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  // Første linje har 75 oktetter, de efterfølgende 74 (+1 til det indledende mellemrum).
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcsCalendar(events: IcsEvent[], options: { name: string }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Holdbold//Kalender//DA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.name)}`,
    "X-WR-TIMEZONE:Europe/Copenhagen",
    // Hint til abonnerende klienter om, hvor ofte feedet kan hentes igen.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H"
  ];

  for (const event of events) {
    const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${formatIcsDate(event.updatedAt ?? new Date())}`,
      `DTSTART:${formatIcsDate(event.start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcsText(event.canceled ? `AFLYST: ${event.title}` : event.title)}`
    );
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    lines.push(`STATUS:${event.canceled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
