// Rene hjælpefunktioner til begivenheder (flyttet ud af den gamle kalenderside, uændret adfærd).

export type SignupLog = {
  id: string;
  status: string;
  reason?: string | null;
  deadlineAt?: string | null;
  createdAt: string;
  user: { id: string; name: string | null; image?: string | null };
};

export type EventLog = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor?: { name: string | null; image?: string | null } | null;
};

type MemberLike = { role: string; user: { id: string } };

/** Logs forventes sorteret nyeste først (som API'et returnerer dem). */
export function computeLateGroups<M extends MemberLike>(params: {
  members: M[];
  statusByUser: Map<string, string>;
  logs: SignupLog[];
  deadlineAt: string | null;
  now?: number;
}) {
  const { members, statusByUser, logs } = params;
  const deadlineIso = params.deadlineAt ?? logs.find((entry) => entry.deadlineAt)?.deadlineAt ?? null;
  const deadlineMs = deadlineIso ? new Date(deadlineIso).getTime() : null;
  const lateResponses: M[] = [];
  const missingAfterDeadline: M[] = [];
  if (!deadlineMs) return { lateResponses, missingAfterDeadline, deadlineAt: null as string | null };

  const latestLogByUser = new Map<string, SignupLog>();
  for (const log of logs) {
    if (!latestLogByUser.has(log.user.id)) latestLogByUser.set(log.user.id, log);
  }
  const now = params.now ?? Date.now();

  for (const member of members) {
    if (member.role === "SOME") continue;
    const status = statusByUser.get(member.user.id);
    const latest = latestLogByUser.get(member.user.id);
    const latestAt = latest ? new Date(latest.createdAt).getTime() : null;
    if ((status === "IN" || status === "OUT") && latestAt && latestAt > deadlineMs) {
      lateResponses.push(member);
      continue;
    }
    if ((!status || status === "UNKNOWN") && now > deadlineMs) missingAfterDeadline.push(member);
  }
  return { lateResponses, missingAfterDeadline, deadlineAt: deadlineIso };
}

export type HistoryEntry = {
  id: string;
  createdAt: string;
  type: string;
  name: string;
  image?: string | null;
  status?: string;
  reason?: string | null;
  late?: boolean;
  message?: string;
};

export function mergeHistory(logs: SignupLog[], eventLogs: EventLog[]): HistoryEntry[] {
  return [
    ...logs.map((log) => ({
      id: `signup-${log.id}`,
      createdAt: log.createdAt,
      type: "SIGNUP",
      status: log.status,
      name: log.user?.name ?? "Ukendt",
      image: log.user?.image ?? null,
      reason: log.reason,
      late: Boolean(log.deadlineAt && new Date(log.createdAt).getTime() > new Date(log.deadlineAt).getTime())
    })),
    ...eventLogs
      .filter((entry) => entry.type !== "SIGNUP")
      .map((entry) => ({
        id: `event-${entry.id}`,
        createdAt: entry.createdAt,
        type: entry.type,
        message: entry.message,
        name: entry.actor?.name ?? "System",
        image: entry.actor?.image ?? null
      }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function sumVotes(draft: Record<string, number>) {
  return Object.values(draft).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
}

export type Recurrence = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

const WEEKDAY_PLURAL = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

/** "Træning hver 2. tirsdag kl. 18:30" / "Kamp lørdag 14. okt. kl. 13:00" */
export function buildRecurrenceSummary(params: {
  kind: "TRAINING" | "MATCH";
  start: Date | null;
  recurrence: Recurrence;
  interval: number;
}) {
  const label = params.kind === "MATCH" ? "Kamp" : "Træning";
  if (!params.start || Number.isNaN(params.start.getTime())) return `${label} – vælg dato og tid`;
  const time = params.start.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  const n = Math.max(1, params.interval || 1);
  const every = n === 1 ? "hver" : `hver ${n}.`;
  switch (params.recurrence) {
    case "ONCE": {
      const date = params.start.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "short" });
      return `${label} ${date} kl. ${time}`;
    }
    case "DAILY":
      return `${label} ${n === 1 ? "hver dag" : `hver ${n}. dag`} kl. ${time}`;
    case "WEEKLY":
      return `${label} ${every} ${WEEKDAY_PLURAL[params.start.getDay()]} kl. ${time}`;
    case "MONTHLY":
      return `${label} ${every} måned d. ${params.start.getDate()}. kl. ${time}`;
    case "YEARLY":
      return `${label} ${every} år kl. ${time}`;
    default:
      return label;
  }
}

/** "24 timer før" → "dagen før" osv. */
export function deadlineLabel(hours: number) {
  if (hours === 0) return "ved start";
  if (hours % 24 === 0) return hours === 24 ? "dagen før" : `${hours / 24} dage før`;
  return `${hours} timer før`;
}

/** datetime-local-værdi ("YYYY-MM-DDTHH:mm") i lokal tid. */
export function toDateTimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
