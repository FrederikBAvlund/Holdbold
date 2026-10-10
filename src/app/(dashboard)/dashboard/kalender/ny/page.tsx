"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import { useToast } from "@/components/ToastProvider";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { Card, EmptyState, Field, ListGroup, PageHeader, Section, Stepper, inputClass } from "@/components/ui/primitives";
import { eventHref, type EventKind } from "@/lib/events/client";
import { buildRecurrenceSummary, deadlineLabel, type Recurrence } from "@/lib/events/eventUtils";
import { EVENT_MANAGER_ROLES, hasAnyRole, isAdminRoles } from "@/lib/roles";

type Series = {
  id: string;
  title: string;
  location: string;
  startDate: string;
  recurrence: Recurrence;
  interval: number;
  endDate: string | null;
  kind: EventKind;
};

const RECURRENCES: Array<{ value: Recurrence; label: string }> = [
  { value: "ONCE", label: "Én gang" },
  { value: "WEEKLY", label: "Ugentligt" },
  { value: "DAILY", label: "Dagligt" },
  { value: "MONTHLY", label: "Månedligt" },
  { value: "YEARLY", label: "Årligt" }
];

const DEADLINES = [2, 12, 24, 48];

const UNIT: Record<Recurrence, string> = { ONCE: "", DAILY: "dag", WEEKLY: "uge", MONTHLY: "måned", YEARLY: "år" };

function toIsoEndOfLocalDay(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function NewEventPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const { teamId, actingMember, membersLoading } = useDashboardTeam();
  const canManage = hasAnyRole(actingMember?.roles, EVENT_MANAGER_ROLES);

  const [kind, setKind] = useState<EventKind>("TRAINING");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("ONCE");
  const [interval, setIntervalValue] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [saving, setSaving] = useState(false);
  const [series, setSeries] = useState<Series[] | null>(null);

  useEffect(() => {
    if (!teamId || !canManage) return;
    fetch(`/api/event-series?teamId=${teamId}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { series: [] }))
      .then((data) => setSeries(data.series ?? []))
      .catch(() => setSeries([]));
  }, [teamId, canManage]);

  const startDate = start ? new Date(start) : null;
  const summary = useMemo(
    () => buildRecurrenceSummary({ kind, start: startDate, recurrence, interval }),
    [kind, start, recurrence, interval] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const valid = title.trim() && location.trim() && startDate && !Number.isNaN(startDate.getTime());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || !startDate || saving) return;
    setSaving(true);
    try {
      const response =
        recurrence === "ONCE"
          ? await fetch("/api/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId,
                title: title.trim(),
                location: location.trim(),
                date: startDate.toISOString(),
                signupDeadline: new Date(startDate.getTime() - deadlineHours * 3_600_000).toISOString(),
                kind
              })
            })
          : await fetch("/api/event-series", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId,
                title: title.trim(),
                location: location.trim(),
                startDate: startDate.toISOString(),
                recurrence,
                interval,
                endDate: toIsoEndOfLocalDay(endDate) ?? undefined,
                signupDeadlineHoursBefore: deadlineHours,
                kind
              })
            });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke oprette", "error");
        return;
      }
      pushToast(recurrence === "ONCE" ? "Begivenhed oprettet 🎉" : "Fast begivenhed oprettet 🎉", "success");
      if (recurrence === "ONCE" && data.event?.id) router.push(eventHref(data.event.id));
      else router.push("/dashboard/kalender");
    } finally {
      setSaving(false);
    }
  }

  if (!membersLoading && actingMember && !canManage) {
    return (
      <div className="space-y-4 pt-2">
        <BackLink />
        <EmptyState icon="calendar" title="Kun for ledere" description="Admin, trænere og bødekasseformand kan oprette begivenheder." />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 pt-1">
      <BackLink />
      <PageHeader title="Ny begivenhed" />

      <div className="hero-surface rounded-[1.5rem] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-on-primary/70">Opsummering</p>
        <p className="mt-1 font-display text-2xl font-bold uppercase leading-tight">{title.trim() || summary}</p>
        {title.trim() ? <p className="mt-0.5 text-sm text-on-primary/85">{summary}</p> : null}
        <p className="mt-1 text-sm text-on-primary/85">
          {location.trim() ? `${location.trim()} · ` : ""}Svar senest {deadlineLabel(deadlineHours)}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Section title="Hvad" anchor="event-form">
          <div className="grid grid-cols-2 gap-2">
            {(["TRAINING", "MATCH"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                aria-pressed={kind === option}
                className={cn(
                  "flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.375rem] border-2 font-display text-xl font-bold uppercase transition active:scale-[0.98]",
                  kind === option ? "border-moss bg-moss/10 text-ink" : "border-line bg-surface text-ink/55"
                )}
              >
                <Icon name={option === "MATCH" ? "ball" : "whistle"} className="h-7 w-7" />
                {option === "MATCH" ? "Kamp" : "Træning"}
              </button>
            ))}
          </div>
          <Card className="space-y-4">
            <Field label={kind === "MATCH" ? "Modstander" : "Titel"} htmlFor="title">
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === "MATCH" ? "Fx Brøndby IF 3" : "Fx Tirsdagstræning"}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Sted" htmlFor="location">
              <input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Fx Valby Idrætspark, Bane 4"
                className={inputClass}
                required
              />
            </Field>
          </Card>
        </Section>

        <Section title="Hvornår">
          <Card className="space-y-4">
            <Field label="Start" htmlFor="start">
              <input
                id="start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <div className="space-y-2" data-guide="event-recurrence">
              <p className="text-sm font-semibold text-ink/80">Gentagelse</p>
              <div className="flex flex-wrap gap-2">
                {RECURRENCES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRecurrence(option.value)}
                    aria-pressed={recurrence === option.value}
                    className={cn(
                      "min-h-10 rounded-full border px-4 text-sm font-semibold transition active:scale-95",
                      recurrence === option.value ? "border-ink bg-ink text-bg" : "border-line text-ink/70"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {recurrence !== "ONCE" ? (
              <>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink/[0.04] px-4 py-3">
                  <span className="text-sm font-semibold text-ink/80">
                    Hver {interval === 1 ? "" : `${interval}. `}
                    {UNIT[recurrence]}
                  </span>
                  <Stepper size="sm" value={interval} onChange={setIntervalValue} min={1} max={12} label="Interval" />
                </div>
                <Field label="Slutter (valgfri)" htmlFor="end" hint="Lad feltet stå tomt, hvis den faste begivenhed bare kører videre.">
                  <input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
                </Field>
              </>
            ) : null}
          </Card>
        </Section>

        <Section title="Svarfrist">
          <Card className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {DEADLINES.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setDeadlineHours(hours)}
                  aria-pressed={deadlineHours === hours}
                  className={cn(
                    "min-h-12 rounded-2xl border text-sm font-semibold transition active:scale-95",
                    deadlineHours === hours ? "border-moss bg-moss/10 text-ink" : "border-line text-ink/65"
                  )}
                >
                  {hours} t
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink/60">Eller vælg selv (timer før start)</span>
              <Stepper size="sm" value={deadlineHours} onChange={setDeadlineHours} min={0} max={336} label="Timer før" />
            </div>
          </Card>
        </Section>

        <Button type="submit" block size="lg" icon="check" loading={saving} disabled={!valid}>
          {recurrence === "ONCE" ? "Opret begivenhed" : "Opret fast begivenhed"}
        </Button>
      </form>

      {series && series.length > 0 ? <SeriesList series={series} onChange={setSeries} isAdmin={isAdminRoles(actingMember?.roles)} /> : null}
    </div>
  );
}

function SeriesList({ series, onChange, isAdmin }: { series: Series[]; onChange: (series: Series[]) => void; isAdmin: boolean }) {
  const { pushToast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [closing, setClosing] = useState<Series | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);

  async function closeDown(item: Series) {
    setCloseBusy(true);
    try {
      const response = await fetch(`/api/event-series/${item.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Kunne ikke lukke den faste begivenhed");
      // Lukkede faste begivenheder forsvinder fra overblikket.
      onChange(series.filter((entry) => entry.id !== item.id));
      pushToast("Den faste begivenhed er slettet, og fremtidige begivenheder er fjernet", "success");
      setClosing(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke lukke den faste begivenhed", "error");
    } finally {
      setCloseBusy(false);
    }
  }

  async function save(item: Series) {
    const value = drafts[item.id] ?? "";
    setSaving(item.id);
    try {
      const response = await fetch(`/api/event-series/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endDate: toIsoEndOfLocalDay(value) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Kunne ikke gemme");
      onChange(series.map((entry) => (entry.id === item.id ? { ...entry, endDate: data.series?.endDate ?? null } : entry)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      pushToast(value ? "Slutdato gemt" : "Slutdato fjernet", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke gemme", "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Section title="Faste begivenheder">
      <ListGroup>
        {series.map((item) => {
          const current = item.endDate ? item.endDate.slice(0, 10) : "";
          const value = drafts[item.id] ?? current;
          const dirty = value !== current;
          return (
            <div key={item.id} className="space-y-2 px-4 py-3">
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-sm text-ink/55">
                  {buildRecurrenceSummary({
                    kind: item.kind,
                    start: new Date(item.startDate),
                    recurrence: item.recurrence,
                    interval: item.interval
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={value}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  aria-label={`Slutdato for ${item.title}`}
                  className={cn(inputClass, "min-h-11 flex-1")}
                />
                {dirty ? (
                  <Button size="sm" loading={saving === item.id} onClick={() => save(item)}>
                    Gem
                  </Button>
                ) : (
                  <span className="w-16 text-right text-xs text-ink/45">{current ? "Slutter" : "Kører videre"}</span>
                )}
              </div>
              {isAdmin ? (
                <Button variant="danger" size="sm" icon="x" onClick={() => setClosing(item)}>
                  Slet fast begivenhed
                </Button>
              ) : null}
            </div>
          );
        })}
      </ListGroup>
      <ConfirmSheet
        open={Boolean(closing)}
        onClose={() => setClosing(null)}
        onConfirm={() => closing && closeDown(closing)}
        loading={closeBusy}
        title={`Slet "${closing?.title ?? ""}"?`}
        description="Alle fremtidige begivenheder fjernes (undtagen dem med bøder), og den faste begivenhed forsvinder fra overblikket. Afholdte begivenheder bevares."
        confirmLabel="Slet fast begivenhed"
      />
    </Section>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/kalender"
      className="inline-flex min-h-10 items-center gap-1 rounded-full pr-3 text-sm font-semibold text-ink/65 hover:text-ink"
    >
      <Icon name="chevron-left" className="h-5 w-5" />
      Kalender
    </Link>
  );
}
