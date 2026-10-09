"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDashboardTeam, type DashboardTeamMember } from "@/components/DashboardTeamProvider";
import { useToast } from "@/components/ToastProvider";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { Card, Chip, KindTag, ListGroup, ListRow, Section, SegmentedControl, Skeleton } from "@/components/ui/primitives";
import RsvpControl from "@/components/events/RsvpControl";
import { DutyWheelModal, type DutyWheelAppliedPayload, type DutyWheelNextEvent } from "@/components/DutyWheelModal";
import {
  eventHref,
  fetchEventDetail,
  fetchEventSignups,
  groupSignups,
  isPast,
  isSeriesOccurrence,
  materializeEvent,
  parseSeriesOccurrenceId,
  patchEvent,
  postSignup,
  type EventDetail,
  type EventSignup,
  type SignupStatus
} from "@/lib/events/client";
import { formatCountdown, formatDayLabel, formatTime } from "@/lib/format";
import { EVENT_MANAGER_ROLES, FINE_MANAGER_ROLES, roleLabel } from "@/lib/roleLabels";

type Tab = "IN" | "OUT" | "UNKNOWN";
type DutyField = "thingCarrierId" | "beerCarrierId";

export default function EventPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const { teamId, userId, members, actingMember } = useDashboardTeam();
  const rawId = decodeURIComponent(params.eventId);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [signups, setSignups] = useState<EventSignup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("IN");
  const [editing, setEditing] = useState<DashboardTeamMember | null>(null);
  const [dutyPicker, setDutyPicker] = useState<DutyField | null>(null);
  const [savingDuty, setSavingDuty] = useState(false);
  const [wheel, setWheel] = useState<{
    kind: "thing" | "beer";
    beerPreviouslyUserIds: string[];
    nextEvent: DutyWheelNextEvent | null;
  } | null>(null);
  const [wheelLoading, setWheelLoading] = useState(false);

  const role = actingMember?.role ?? "";
  const canManageEvents = EVENT_MANAGER_ROLES.includes(role);
  const canEditOthers = FINE_MANAGER_ROLES.includes(role);

  // Serie-forekomster findes først som rigtig begivenhed, når de åbnes.
  useEffect(() => {
    if (!isSeriesOccurrence(rawId) || !teamId) return;
    const parsed = parseSeriesOccurrenceId(rawId);
    if (!parsed) return;
    materializeEvent(teamId, { id: rawId, seriesId: parsed.seriesId, date: parsed.date })
      .then((realId) => router.replace(eventHref(realId)))
      .catch((err) => setError(err instanceof Error ? err.message : "Kunne ikke åbne begivenheden"));
  }, [rawId, teamId, router]);

  const reload = useCallback(async () => {
    if (isSeriesOccurrence(rawId)) return;
    try {
      const [detail, list] = await Promise.all([fetchEventDetail(rawId), fetchEventSignups(rawId)]);
      setEvent(detail);
      setSignups(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente begivenheden");
    }
  }, [rawId]);

  useEffect(() => {
    setEvent(null);
    setSignups(null);
    setEditing(null);
    setError(null);
    reload();
  }, [reload]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.user.id, member])), [members]);
  const groups = useMemo(() => groupSignups(members, signups ?? []), [members, signups]);
  const myStatus: SignupStatus = (signups ?? []).find((signup) => signup.userId === userId)?.status ?? "UNKNOWN";

  if (error) {
    return (
      <div className="space-y-4 pt-2">
        <BackLink />
        <Card className="text-center">
          <p className="font-display text-2xl font-bold uppercase text-ink">Hov!</p>
          <p className="mt-1 text-ink/60">{error}</p>
        </Card>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-4 pt-2">
        <BackLink />
        <Skeleton className="h-72 rounded-[1.75rem]" />
        <Skeleton className="h-28 rounded-[1.375rem]" />
        <Skeleton className="h-48 rounded-[1.375rem]" />
      </div>
    );
  }

  const canceled = Boolean(event.canceledAt);
  const past = isPast(event);
  const isMatch = event.kind === "MATCH";
  const hasScore = isMatch && typeof event.matchHomeGoals === "number" && typeof event.matchAwayGoals === "number";
  const mapsHref = event.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
    : null;
  const classicHref = `/dashboard/kalender/klassisk?${new URLSearchParams({
    focusEvent: event.id,
    focusDate: event.date,
    focusTitle: event.title,
    focusLocation: event.location ?? "",
    focusSource: event.source ?? "MANUAL"
  }).toString()}`;

  const tabRows = tab === "IN" ? groups.coming : tab === "OUT" ? groups.notComing : groups.missing;

  async function copyLocation() {
    try {
      await navigator.clipboard.writeText(event!.location);
      pushToast("Adresse kopieret", "success");
    } catch {
      pushToast("Kunne ikke kopiere", "error");
    }
  }

  async function saveDuty(field: DutyField, memberUserId: string | null) {
    setSavingDuty(true);
    try {
      await patchEvent(event!.id, { [field]: memberUserId });
      setEvent((prev) => (prev ? { ...prev, [field]: memberUserId } : prev));
      pushToast(field === "beerCarrierId" ? "Øl-ansvarlig opdateret" : "Tingene-ansvarlig opdateret", "success");
      setDutyPicker(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke gemme", "error");
    } finally {
      setSavingDuty(false);
    }
  }

  async function openWheel(kind: "thing" | "beer") {
    setWheelLoading(true);
    try {
      const response = await fetch(`/api/events/${event!.id}/duty-wheel`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke åbne hjulet", "error");
        return;
      }
      const next = data.nextEvent;
      setWheel({
        kind,
        beerPreviouslyUserIds: Array.isArray(data.beerPreviouslyUserIds) ? data.beerPreviouslyUserIds : [],
        nextEvent:
          next && typeof next.id === "string" && typeof next.title === "string" && typeof next.date === "string"
            ? { id: next.id, title: next.title, date: next.date, kind: String(next.kind ?? "") }
            : null
      });
    } finally {
      setWheelLoading(false);
    }
  }

  function onWheelApplied(payload: DutyWheelAppliedPayload) {
    if (payload.targetEventId === event!.id) {
      setEvent((prev) => (prev ? { ...prev, [payload.field]: payload.userId } : prev));
    }
  }

  return (
    <div className="space-y-6 pb-8 pt-1">
      <BackLink />

      {/* Hero */}
      <section
        className={cn(
          "rounded-[1.75rem] p-5 shadow-[0_24px_48px_-28px_var(--primary)]",
          canceled ? "border border-line bg-surface text-ink shadow-none" : "hero-surface"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <KindTag kind={event.kind} onHero={!canceled} />
          {canceled ? <Chip tone="out">Aflyst</Chip> : null}
          {past && !canceled ? <Chip tone={canceled ? "neutral" : "onHero"}>Afviklet</Chip> : null}
        </div>
        <h1
          className={cn(
            "mt-3 font-display text-[2.5rem] font-extrabold uppercase leading-[0.95] tracking-tight",
            canceled && "line-through decoration-[3px]"
          )}
        >
          {event.title}
        </h1>

        {hasScore ? (
          <p className="tabular mt-3 font-display text-6xl font-extrabold leading-none">
            {event.matchHomeGoals} <span className="opacity-60">–</span> {event.matchAwayGoals}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <HeroStat label={formatDayLabel(event.date)} value={formatTime(event.date)} muted={canceled} />
          {!past && !canceled ? (
            <HeroStat label="Starter" value={formatCountdown(event.date)} muted={canceled} />
          ) : isMatch && event.meetingTime ? (
            <HeroStat label="Mødetid" value={formatTime(event.meetingTime)} muted={canceled} />
          ) : null}
        </div>

        <div className={cn("mt-4 space-y-2 text-sm", canceled ? "text-ink/70" : "text-on-primary/90")}>
          {isMatch && event.meetingTime && !past ? (
            <p className="flex items-center gap-2">
              <Icon name="clock" className="h-4 w-4" />
              Mødetid kl. {formatTime(event.meetingTime)}
            </p>
          ) : null}
          {event.signupDeadline && !past ? (
            <p className="flex items-center gap-2">
              <Icon name="hourglass" className="h-4 w-4" />
              Svar senest {formatDayLabel(event.signupDeadline).toLowerCase()} kl. {formatTime(event.signupDeadline)}
            </p>
          ) : null}
          {event.location ? (
            <div className="flex items-center gap-2">
              <Icon name="map-pin" className="h-4 w-4 shrink-0" />
              <a href={mapsHref ?? undefined} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                {event.location}
              </a>
              <button
                type="button"
                onClick={copyLocation}
                aria-label="Kopiér adresse"
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95",
                  canceled ? "bg-ink/[0.06]" : "bg-on-primary/15 hover:bg-on-primary/25"
                )}
              >
                <Icon name="copy" className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* Dit svar */}
      <Section title="Dit svar">
        <Card>
          {!past && !canceled ? (
            <p className="mb-3 text-sm text-ink/60">
              {myStatus === "IN"
                ? "Du er meldt til. Kan du alligevel ikke, så meld afbud her."
                : myStatus === "OUT"
                  ? "Du har meldt afbud. Kan du alligevel, så meld dig til."
                  : "Kommer du? Holdet tæller på dig."}
            </p>
          ) : null}
          <RsvpControl
            teamId={teamId}
            userId={userId}
            event={event}
            status={myStatus}
            onSaved={() => reload()}
          />
        </Card>
      </Section>

      {/* Hvem kommer */}
      <Section title="Holdet">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          size="sm"
          options={[
            { value: "IN", label: "Kommer", count: groups.coming.length },
            { value: "OUT", label: "Kan ikke", count: groups.notComing.length },
            { value: "UNKNOWN", label: "Mangler", count: groups.missing.length }
          ]}
        />
        {signups === null ? (
          <Skeleton className="h-40 rounded-[1.375rem]" />
        ) : tabRows.length === 0 ? (
          <p className="px-1 py-3 text-sm text-ink/55">
            {tab === "IN" ? "Ingen har meldt til endnu." : tab === "OUT" ? "Ingen afbud." : "Alle har svaret 🎉"}
          </p>
        ) : (
          <ListGroup>
            {tabRows.map(({ member, signup }) => (
              <ListRow
                key={member.user.id}
                leading={<Avatar name={member.user.name} image={member.user.image} size="md" />}
                title={
                  <>
                    {member.user.name ?? "Ukendt"}
                    {member.user.id === userId ? <span className="ml-1.5 text-ink/45">(dig)</span> : null}
                  </>
                }
                subtitle={signup?.status === "OUT" && signup.reason ? `“${signup.reason}”` : roleLabel(member.role)}
                trailing={
                  event.thingCarrierId === member.user.id || event.beerCarrierId === member.user.id ? (
                    <span className="flex gap-1 text-ink/50">
                      {event.thingCarrierId === member.user.id ? <Icon name="bag" className="h-4 w-4" /> : null}
                      {event.beerCarrierId === member.user.id ? <Icon name="beer" className="h-4 w-4" /> : null}
                    </span>
                  ) : undefined
                }
                chevron={canEditOthers && !canceled}
                onClick={canEditOthers && !canceled ? () => setEditing(member) : undefined}
              />
            ))}
          </ListGroup>
        )}
      </Section>

      {/* Opgaver */}
      <Section title="Opgaver">
        <ListGroup>
          <DutyRow
            icon="bag"
            label="Tingene"
            hint="Bolde, kegler og overtrækstrøjer"
            person={event.thingCarrierId ? memberById.get(event.thingCarrierId) : undefined}
            disabled={canceled}
            busy={wheelLoading}
            onWheel={() => openWheel("thing")}
            onPick={() => setDutyPicker("thingCarrierId")}
          />
          <DutyRow
            icon="beer"
            label="Øl"
            hint="Køl dem ned i god tid"
            person={event.beerCarrierId ? memberById.get(event.beerCarrierId) : undefined}
            disabled={canceled}
            busy={wheelLoading}
            onWheel={() => openWheel("beer")}
            onPick={() => setDutyPicker("beerCarrierId")}
          />
        </ListGroup>
      </Section>

      {/* Mere – flyttes ind på siden i næste fase */}
      <Section title="Mere">
        <ListGroup>
          {isMatch ? (
            <>
              <ListRow
                href={classicHref}
                leading={<RowIcon name="ball" />}
                title="Resultat og statistik"
                subtitle="Mål, assists og kort"
                chevron
              />
              <ListRow
                href={classicHref}
                leading={<RowIcon name="trophy" />}
                title="Kampens spiller"
                subtitle="Stem på dagens bedste"
                chevron
              />
            </>
          ) : null}
          {canEditOthers ? (
            <ListRow
              href={classicHref}
              leading={<RowIcon name="receipt" />}
              title="Bøder for sene svar"
              subtitle="Giv bøder til dem, der svarede for sent"
              chevron
            />
          ) : null}
          {canManageEvents ? (
            <ListRow
              href={classicHref}
              leading={<RowIcon name="settings" />}
              title="Administrér begivenhed"
              subtitle="Type, mødetid, aflysning og historik"
              chevron
            />
          ) : null}
          {!isMatch && !canEditOthers && !canManageEvents ? (
            <ListRow leading={<RowIcon name="whistle" />} title="Træning" subtitle="Ikke mere at se her." />
          ) : null}
        </ListGroup>
      </Section>

      <EditSignupSheet
        member={editing}
        eventId={event.id}
        current={editing ? (signups ?? []).find((signup) => signup.userId === editing.user.id) ?? null : null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />

      <Sheet
        open={dutyPicker !== null}
        onClose={() => setDutyPicker(null)}
        title={dutyPicker === "beerCarrierId" ? "Hvem har øl med?" : "Hvem har tingene med?"}
        dismissible={!savingDuty}
      >
        <div className="space-y-1.5">
          <button
            type="button"
            disabled={savingDuty}
            onClick={() => dutyPicker && saveDuty(dutyPicker, null)}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-ink/65 hover:bg-ink/[0.04]"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.06]">
              <Icon name="x" className="h-4 w-4" />
            </span>
            Ingen
          </button>
          {[...groups.coming, ...groups.missing, ...groups.notComing].map(({ member, signup }) => {
            const selected = dutyPicker ? event[dutyPicker] === member.user.id : false;
            return (
              <button
                key={member.user.id}
                type="button"
                disabled={savingDuty}
                onClick={() => dutyPicker && saveDuty(dutyPicker, member.user.id)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition",
                  selected ? "bg-moss/10" : "hover:bg-ink/[0.04]"
                )}
              >
                <Avatar name={member.user.name} image={member.user.image} size="md" />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{member.user.name}</span>
                {signup?.status === "IN" ? <Chip tone="in">Kommer</Chip> : null}
                {selected ? <Icon name="check" className="h-5 w-5 text-moss" strokeWidth={2.6} /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>

      {wheel ? (
        <DutyWheelModal
          kind={wheel.kind}
          eventId={event.id}
          members={members}
          signups={(signups ?? []).map((signup) => ({
            userId: signup.userId,
            status: signup.status,
            user: { id: signup.user.id, name: signup.user.name }
          }))}
          beerPreviouslyUserIds={wheel.beerPreviouslyUserIds}
          nextEvent={wheel.nextEvent}
          onClose={() => setWheel(null)}
          onApplied={onWheelApplied}
          showToast={(message, variant) => pushToast(message, variant)}
        />
      ) : null}
    </div>
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

function HeroStat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-3.5 py-3", muted ? "bg-ink/[0.05]" : "bg-on-primary/12")}>
      <p className={cn("text-xs font-semibold uppercase tracking-wider", muted ? "text-ink/55" : "text-on-primary/70")}>
        {label}
      </p>
      <p className="tabular mt-0.5 font-display text-[2rem] font-bold leading-none">{value}</p>
    </div>
  );
}

function RowIcon({ name }: { name: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
      <Icon name={name} />
    </span>
  );
}

function DutyRow({
  icon,
  label,
  hint,
  person,
  disabled,
  busy,
  onWheel,
  onPick
}: {
  icon: "bag" | "beer";
  label: string;
  hint: string;
  person?: DashboardTeamMember;
  disabled?: boolean;
  busy?: boolean;
  onWheel: () => void;
  onPick: () => void;
}) {
  return (
    <div className="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
      {person ? (
        <Avatar name={person.user.name} image={person.user.image} size="md" />
      ) : (
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-ink/20 text-ink/40">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <button type="button" disabled={disabled} onClick={onPick} className="min-w-0 flex-1 text-left">
        <span className="block text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</span>
        <span className="block truncate font-semibold text-ink">{person?.user.name ?? "Ingen valgt endnu"}</span>
        {!person ? <span className="block truncate text-xs text-ink/45">{hint}</span> : null}
      </button>
      <Button size="sm" variant="secondary" icon="wheel" disabled={disabled} loading={busy} onClick={onWheel}>
        Træk lod
      </Button>
    </div>
  );
}

function EditSignupSheet({
  member,
  eventId,
  current,
  onClose,
  onSaved
}: {
  member: DashboardTeamMember | null;
  eventId: string;
  current: EventSignup | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { pushToast } = useToast();
  const [status, setStatus] = useState<SignupStatus>("UNKNOWN");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(current?.status ?? "UNKNOWN");
    setReason(current?.reason ?? "");
  }, [member, current]);

  async function save() {
    if (!member) return;
    if (status === "OUT" && reason.trim().length < 2) {
      pushToast("Skriv en kort begrundelse", "error");
      return;
    }
    setSaving(true);
    try {
      await postSignup(eventId, { userId: member.user.id, status, reason });
      pushToast("Svar opdateret", "success");
      onSaved();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke opdatere", "error");
    } finally {
      setSaving(false);
    }
  }

  const options: Array<{ value: SignupStatus; label: string; tone: string }> = [
    { value: "IN", label: "Kommer", tone: "bg-in text-on-solid" },
    { value: "OUT", label: "Kan ikke", tone: "bg-out text-on-solid" },
    { value: "UNKNOWN", label: "Mangler svar", tone: "bg-pending text-on-solid" }
  ];

  return (
    <Sheet
      open={Boolean(member)}
      onClose={onClose}
      dismissible={!saving}
      title={member ? `Ret svar for ${member.user.name?.split(" ")[0] ?? ""}` : ""}
      description="Ændringen logges i historikken."
      footer={
        <Button block size="lg" loading={saving} onClick={save}>
          Gem svar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              aria-pressed={status === option.value}
              className={cn(
                "min-h-12 rounded-2xl text-sm font-semibold transition active:scale-95",
                status === option.value ? option.tone : "bg-ink/[0.06] text-ink/70"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {status === "OUT" ? (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Begrundelse (påkrævet)"
            className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-ink/40 focus:border-moss focus:outline-none focus:ring-4 focus:ring-moss/15"
          />
        ) : null}
      </div>
    </Sheet>
  );
}
