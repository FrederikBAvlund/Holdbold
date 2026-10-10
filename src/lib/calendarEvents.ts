import { defaultDurationMinutes, type IcsEvent } from "@/lib/ics";

/** Serveren kører i UTC, så klokkeslæt til beskrivelsen formateres eksplicit i dansk tid. */
function formatCopenhagenTime(date: Date) {
  return date.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });
}

type EventRow = {
  id: string;
  title: string;
  date: Date;
  location: string;
  kind: string;
  meetingTime: Date | null;
  canceledAt: Date | null;
  team: { name: string };
};

/** Oversætter en begivenhed til en kalenderpost. `withTeamPrefix` bruges, når feedet samler flere hold. */
export function toIcsEvent(event: EventRow, options: { withTeamPrefix?: boolean } = {}): IcsEvent {
  const descriptionLines = [event.team.name];
  if (event.meetingTime) descriptionLines.push(`Mødetid kl. ${formatCopenhagenTime(event.meetingTime)}`);
  return {
    uid: `event-${event.id}@holdbold`,
    title: options.withTeamPrefix ? `${event.title} (${event.team.name})` : event.title,
    start: event.date,
    durationMinutes: defaultDurationMinutes(event.kind),
    location: event.location,
    description: descriptionLines.join("\n"),
    canceled: Boolean(event.canceledAt)
  };
}
