"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import { useToast } from "@/components/ToastProvider";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { Chip, ListGroup, ListRow, PageHeader, Section, Skeleton, inputClass } from "@/components/ui/primitives";
import { roleLabel } from "@/lib/roleLabels";
import { firstName } from "@/lib/format";
import {
  LEADERBOARD_CATEGORY_LABELS_DA,
  type LeaderboardCategory,
  type LeaderboardRow,
  type LeaderboardTop
} from "@/lib/leaderboardsShared";
import { LEADERBOARD_GROUPS, LEADERBOARD_SHORT } from "@/lib/leaderboardDisplay";

const ROLE_ORDER = ["ADMIN", "TRAENER", "BOEDEKASSEFORMAND", "SOME", "SPILLER"];

export default function HoldPage() {
  const { pushToast } = useToast();
  const { teamId, userId, members, memberships, membersLoading, actingMember } = useDashboardTeam();
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState<Record<LeaderboardCategory, LeaderboardTop[]> | null>(null);
  const [openCategory, setOpenCategory] = useState<LeaderboardCategory | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  const team = memberships.find((membership) => membership.team?.id === teamId)?.team;
  const isAdmin = actingMember?.role === "ADMIN";
  const active = members.filter((member) => member.status === "ACTIVE");
  const pending = members.filter((member) => member.status !== "ACTIVE");

  useEffect(() => {
    if (!teamId) return;
    let alive = true;
    fetch(`/api/teams/${teamId}/leaderboards`)
      .then((response) => (response.ok ? response.json() : { summary: null }))
      .then((data) => alive && setSummary(data.summary ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [teamId]);

  useEffect(() => {
    if (!openCategory || !teamId) return;
    let alive = true;
    setRows(null);
    fetch(`/api/teams/${teamId}/leaderboards?category=${openCategory}`)
      .then((response) => response.json())
      .then((data) => alive && setRows(data.rows ?? []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [openCategory, teamId]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = active.filter((member) => !q || (member.user.name ?? "").toLowerCase().includes(q));
    return ROLE_ORDER.map((role) => ({
      role,
      items: filtered
        .filter((member) => member.role === role)
        .sort((a, b) => (a.user.name ?? "").localeCompare(b.user.name ?? "", "da"))
    })).filter((group) => group.items.length > 0);
  }, [active, query]);

  async function shareInvite() {
    if (!team?.slug) return;
    const url = `${window.location.origin}/signup?slug=${encodeURIComponent(team.slug)}`;
    const text = `Kom med på ${team.name ?? "holdet"} i Holdbold`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Holdbold", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      pushToast("Invitationslink kopieret", "success");
    } catch {
      /* brugeren lukkede delingsarket */
    }
  }

  return (
    <div className="space-y-7 pb-6">
      <PageHeader
        title={team?.name ?? "Holdet"}
        subtitle={`${active.length} spillere og ledere · Du er ${roleLabel(actingMember?.role).toLowerCase()}`}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={shareInvite}
          className="hero-surface flex min-h-[4.5rem] items-center gap-3 rounded-[1.375rem] px-4 text-left transition active:scale-[0.99]"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-on-primary/15">
            <Icon name="share" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-xl font-bold uppercase leading-tight">Inviter spillere</span>
            <span className="block text-sm text-on-primary/80">Del linket – de lander direkte på holdet</span>
          </span>
        </button>
        {isAdmin ? (
          <Link
            href="/dashboard/indstillinger"
            className="flex min-h-[4.5rem] items-center gap-3 rounded-[1.375rem] border border-line bg-surface px-4 transition hover:border-ink/20"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ink/[0.06] text-ink">
              <Icon name="settings" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-ink">Holdindstillinger</span>
              <span className="block text-sm text-ink/55">Roller, MobilePay, tema og kampprogram</span>
            </span>
            <Icon name="chevron-right" className="h-4 w-4 text-ink/35" />
          </Link>
        ) : null}
      </div>

      {isAdmin && pending.length > 0 ? (
        <Section title={`Venter på godkendelse · ${pending.length}`}>
          <ListGroup className="border-pending/40">
            {pending.map((member) => (
              <ListRow
                key={member.id}
                leading={<Avatar name={member.user.name} image={member.user.image} />}
                title={member.user.name ?? member.user.email ?? "Ny bruger"}
                subtitle={member.user.email ?? "Afventer"}
                href="/dashboard/indstillinger"
                trailing={<Chip tone="pending">Ny</Chip>}
                chevron
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      <Section title="Truppen">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søg efter navn"
            className={cn(inputClass, "pl-11")}
            type="search"
          />
        </div>
        {membersLoading && members.length === 0 ? (
          <Skeleton className="h-64 rounded-[1.375rem]" />
        ) : grouped.length === 0 ? (
          <p className="px-1 text-sm text-ink/55">Ingen matcher “{query}”.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.role} className="space-y-1.5">
                <p className="px-1 text-xs font-semibold uppercase tracking-wider text-ink/50">
                  {roleLabel(group.role)} · {group.items.length}
                </p>
                <ListGroup>
                  {group.items.map((member) => (
                    <ListRow
                      key={member.id}
                      leading={<Avatar name={member.user.name} image={member.user.image} />}
                      title={
                        <>
                          {member.user.name ?? "Ukendt"}
                          {member.user.id === userId ? <span className="ml-1.5 text-ink/45">(dig)</span> : null}
                        </>
                      }
                      subtitle={member.user.email ?? undefined}
                    />
                  ))}
                </ListGroup>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Rekorder" className="scroll-mt-20">
        <div id="rekorder" className="space-y-5">
          {LEADERBOARD_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-ink/50">{group.title}</p>
              <ListGroup>
                {group.categories.map((category) => {
                  const top = summary?.[category] ?? [];
                  const leader = top[0];
                  const meta = LEADERBOARD_SHORT[category];
                  return (
                    <ListRow
                      key={category}
                      onClick={() => setOpenCategory(category)}
                      leading={
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
                          <Icon name={meta.icon} />
                        </span>
                      }
                      title={meta.label}
                      subtitle={
                        summary === null
                          ? "Henter…"
                          : leader && leader.value > 0
                            ? top.length > 1
                              ? `${top.map((row) => firstName(row.name)).join(", ")}`
                              : leader.name
                            : "Ingen endnu"
                      }
                      trailing={
                        leader && leader.value > 0 ? (
                          <span className="tabular font-display text-2xl font-bold text-ink">{leader.value}</span>
                        ) : undefined
                      }
                      chevron
                    />
                  );
                })}
              </ListGroup>
            </div>
          ))}
        </div>
      </Section>

      <Sheet
        open={openCategory !== null}
        onClose={() => setOpenCategory(null)}
        title={openCategory ? LEADERBOARD_SHORT[openCategory].label : ""}
        description={openCategory ? LEADERBOARD_CATEGORY_LABELS_DA[openCategory] : undefined}
      >
        {rows === null ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink/55">Ingen data endnu.</p>
        ) : (
          <ol className="space-y-1">
            {rows.map((row) => (
              <li
                key={row.userId}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-3",
                  row.userId === userId && "bg-moss/10"
                )}
              >
                <span
                  className={cn(
                    "tabular w-7 text-center font-display text-xl font-bold",
                    row.rank === 1 ? "text-moss" : "text-ink/45"
                  )}
                >
                  {row.rank}
                </span>
                <Avatar name={row.name} image={row.image} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{row.name}</span>
                <span className="tabular font-display text-xl font-bold text-ink">
                  {row.value}
                  {openCategory === "fines" ? " kr" : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="pt-4">
          <Button block variant="secondary" onClick={() => setOpenCategory(null)}>
            Luk
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
