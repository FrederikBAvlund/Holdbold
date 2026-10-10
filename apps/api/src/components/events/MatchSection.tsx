"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import type { DashboardTeamMember } from "@/components/DashboardTeamProvider";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { Card, Section, Stepper, inputClass } from "@/components/ui/primitives";
import { patchEvent, type EventDetail } from "@/lib/events/client";

type StatRow = { goals: number; assists: number; yellowCards: number; redCards: number };
const EMPTY: StatRow = { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };

function rowsFromEvent(event: EventDetail, members: DashboardTeamMember[]) {
  const byUser = new Map((event.matchPlayerStats ?? []).map((stat) => [stat.userId, stat]));
  return Object.fromEntries(
    members.map((member) => {
      const stat = byUser.get(member.user.id);
      return [
        member.user.id,
        {
          goals: stat?.goals ?? 0,
          assists: stat?.assists ?? 0,
          yellowCards: stat?.yellowCards ?? 0,
          redCards: stat?.redCards ?? 0
        }
      ];
    })
  ) as Record<string, StatRow>;
}

export default function MatchSection({
  event,
  members,
  canEdit,
  teamName,
  onUpdated
}: {
  event: EventDetail;
  members: DashboardTeamMember[];
  canEdit: boolean;
  teamName: string;
  onUpdated: (patch: Partial<EventDetail>) => void;
}) {
  const { pushToast } = useToast();
  const [home, setHome] = useState(event.matchHomeGoals ?? 0);
  const [away, setAway] = useState(event.matchAwayGoals ?? 0);
  const [savingScore, setSavingScore] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, StatRow>>(() => rowsFromEvent(event, members));
  const [search, setSearch] = useState("");
  const [savingStats, setSavingStats] = useState(false);

  useEffect(() => {
    setHome(event.matchHomeGoals ?? 0);
    setAway(event.matchAwayGoals ?? 0);
  }, [event.matchHomeGoals, event.matchAwayGoals]);

  useEffect(() => {
    if (!statsOpen) setRows(rowsFromEvent(event, members));
  }, [event, members, statsOpen]);

  const hasScore = typeof event.matchHomeGoals === "number" && typeof event.matchAwayGoals === "number";
  const scoreDirty = home !== (event.matchHomeGoals ?? 0) || away !== (event.matchAwayGoals ?? 0) || !hasScore;

  const summary = useMemo(() => {
    const memberById = new Map(members.map((member) => [member.user.id, member]));
    return (event.matchPlayerStats ?? [])
      .filter((stat) => stat.goals || stat.assists || stat.yellowCards || stat.redCards)
      .map((stat) => ({ stat, member: memberById.get(stat.userId) }))
      .filter((entry) => entry.member)
      .sort((a, b) => b.stat.goals - a.stat.goals || b.stat.assists - a.stat.assists);
  }, [event.matchPlayerStats, members]);

  async function saveScore() {
    setSavingScore(true);
    try {
      const data = await patchEvent(event.id, { matchHomeGoals: home, matchAwayGoals: away });
      onUpdated({
        matchHomeGoals: data.event?.matchHomeGoals ?? home,
        matchAwayGoals: data.event?.matchAwayGoals ?? away
      });
      pushToast("Resultat gemt", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke gemme resultatet", "error");
    } finally {
      setSavingScore(false);
    }
  }

  async function saveStats() {
    setSavingStats(true);
    try {
      const matchPlayerStats = members.map((member) => ({ userId: member.user.id, ...(rows[member.user.id] ?? EMPTY) }));
      const data = await patchEvent(event.id, { matchPlayerStats });
      onUpdated({ matchPlayerStats: data.event?.matchPlayerStats ?? matchPlayerStats });
      pushToast("Kampstatistik gemt", "success");
      setStatsOpen(false);
      setSearch("");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke gemme statistik", "error");
    } finally {
      setSavingStats(false);
    }
  }

  const visible = members.filter(
    (member) => member.status === "ACTIVE" && (member.user.name ?? "").toLowerCase().includes(search.trim().toLowerCase())
  );

  function setStat(userId: string, key: keyof StatRow, value: number) {
    setRows((prev) => ({ ...prev, [userId]: { ...(prev[userId] ?? EMPTY), [key]: value } }));
  }

  return (
    <Section title="Kampen">
      <Card className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div className="space-y-2">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-ink/55">{teamName || "Os"}</p>
            {canEdit ? (
              <Stepper value={home} onChange={setHome} label="Vores mål" />
            ) : (
              <p className="tabular font-display text-5xl font-extrabold text-ink">{hasScore ? event.matchHomeGoals : "–"}</p>
            )}
          </div>
          <span className="font-display text-3xl font-bold text-ink/30">:</span>
          <div className="space-y-2">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-ink/55">{event.title}</p>
            {canEdit ? (
              <Stepper value={away} onChange={setAway} label="Modstanderens mål" />
            ) : (
              <p className="tabular font-display text-5xl font-extrabold text-ink">{hasScore ? event.matchAwayGoals : "–"}</p>
            )}
          </div>
        </div>
        {canEdit && scoreDirty ? (
          <Button block loading={savingScore} onClick={saveScore} icon="check">
            Gem resultat
          </Button>
        ) : null}

        <div className="border-t border-line pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink/70">Målscorere og kort</p>
            {canEdit ? (
              <Button size="sm" variant="secondary" icon="ball" onClick={() => setStatsOpen(true)}>
                Registrér
              </Button>
            ) : null}
          </div>
          {summary.length === 0 ? (
            <p className="mt-2 text-sm text-ink/50">Intet registreret endnu.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {summary.map(({ stat, member }) => (
                <li key={stat.userId} className="flex items-center gap-3">
                  <Avatar name={member!.user.name} image={member!.user.image} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{member!.user.name}</span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink/70">
                    {stat.goals ? <span className="flex items-center gap-1"><Icon name="ball" className="h-4 w-4" />{stat.goals}</span> : null}
                    {stat.assists ? <span className="flex items-center gap-1"><Icon name="star" className="h-4 w-4" />{stat.assists}</span> : null}
                    {stat.yellowCards ? <span className="inline-block h-4 w-3 rounded-sm bg-[#facc15]" title={`${stat.yellowCards} gule`} /> : null}
                    {stat.redCards ? <span className="inline-block h-4 w-3 rounded-sm bg-[#ef4444]" title={`${stat.redCards} røde`} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Sheet
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        title="Målscorere og kort"
        description="Tryk + for mål, assists og kort."
        dismissible={!savingStats}
        footer={
          <Button block size="lg" loading={savingStats} onClick={saveStats}>
            Gem statistik
          </Button>
        }
      >
        <div className="space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg spiller"
            className={inputClass}
            type="search"
          />
          <div className="grid grid-cols-[1fr_repeat(4,2.5rem)] items-center gap-x-1 px-1 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-ink/50">
            <span className="text-left">Spiller</span>
            <span>Mål</span>
            <span>Ass.</span>
            <span>Gul</span>
            <span>Rød</span>
          </div>
          <ul className="divide-y divide-line">
            {visible.map((member) => {
              const row = rows[member.user.id] ?? EMPTY;
              return (
                <li key={member.user.id} className="grid grid-cols-[1fr_repeat(4,2.5rem)] items-center gap-x-1 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={member.user.name} image={member.user.image} size="sm" />
                    <span className="truncate text-sm font-semibold text-ink">{member.user.name}</span>
                  </span>
                  {(["goals", "assists", "yellowCards", "redCards"] as const).map((key) => (
                    <StatTap
                      key={key}
                      value={row[key]}
                      tone={key}
                      onTap={() => setStat(member.user.id, key, row[key] + 1)}
                      onReset={() => setStat(member.user.id, key, Math.max(0, row[key] - 1))}
                    />
                  ))}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink/50">Tryk for at lægge til. Tryk og hold for at trække fra.</p>
        </div>
      </Sheet>
    </Section>
  );
}

function StatTap({
  value,
  tone,
  onTap,
  onReset
}: {
  value: number;
  tone: keyof StatRow;
  onTap: () => void;
  onReset: () => void;
}) {
  const [timer, setTimer] = useState<number | null>(null);
  const [held, setHeld] = useState(false);
  const active = value > 0;
  const toneClass =
    tone === "yellowCards"
      ? "bg-[#facc15] text-[#422006]"
      : tone === "redCards"
        ? "bg-[#ef4444] text-white"
        : "bg-primary text-on-primary";
  return (
    <button
      type="button"
      aria-label={`${tone}: ${value}`}
      onPointerDown={() => {
        setHeld(false);
        setTimer(
          window.setTimeout(() => {
            setHeld(true);
            onReset();
          }, 450)
        );
      }}
      onPointerUp={() => {
        if (timer) window.clearTimeout(timer);
        setTimer(null);
      }}
      onPointerLeave={() => {
        if (timer) window.clearTimeout(timer);
        setTimer(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (held) {
          setHeld(false);
          return;
        }
        onTap();
      }}
      className={cn(
        "tabular mx-auto inline-flex h-10 w-10 select-none items-center justify-center rounded-xl font-display text-lg font-bold transition active:scale-90",
        active ? toneClass : "bg-ink/[0.06] text-ink/35"
      )}
    >
      {value}
    </button>
  );
}
