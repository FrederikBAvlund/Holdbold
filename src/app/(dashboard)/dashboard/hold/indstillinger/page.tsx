"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import { useToast } from "@/components/ToastProvider";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { Card, EmptyState, Field, ListGroup, PageHeader, Section, inputClass } from "@/components/ui/primitives";
import TeamOpenAiCard from "@/components/team/TeamOpenAiCard";
import { SeasonCloseCard } from "@/components/SeasonSettingsCard";
import { clearMeClientCache } from "@/lib/meClientCache";
import { DEFAULT_THEME_ID, THEME_PRESETS } from "@/lib/themePresets";
import { formatRelativePast } from "@/lib/format";
import { slugify } from "@/lib/superAdmin";

type Feed = { id: string; name: string; url: string; lastImportedAt?: string | null };

export default function TeamSettingsPage() {
  const { pushToast } = useToast();
  const { teamId, memberships, actingMember, membersLoading } = useDashboardTeam();
  const isAdmin = actingMember?.role === "ADMIN";
  const team = memberships.find((membership) => membership.team?.id === teamId)?.team;

  if (!isAdmin && !membersLoading && actingMember) {
    return (
      <div className="space-y-4 pt-2">
        <BackLink />
        <EmptyState icon="settings" title="Kun for admin" description="Holdindstillinger kan kun ændres af holdets admin." />
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-8 pt-1">
      <BackLink />
      <PageHeader title="Holdindstillinger" subtitle={team?.name ?? undefined} />

      <Section title="Holdets udseende">
        <TeamTheme teamId={teamId} onSaved={() => pushToast("Holdets farver er opdateret", "success")} />
      </Section>

      <Section title="Holdkode">
        {teamId ? <TeamSlugCard key={teamId} teamId={teamId} currentSlug={team?.slug ?? ""} /> : null}
      </Section>

      <Section title="Kampprogram">
        <CalendarImport teamId={teamId} />
      </Section>

      <Section title="Sæson">
        <SeasonCloseCard teamId={teamId} />
      </Section>

      <Section title="Indtalte bøder">
        {teamId ? <TeamOpenAiCard key={teamId} teamId={teamId} /> : null}
      </Section>

      <Section title="Flere indstillinger">
        <ListGroup>
          <Link
            href="/dashboard/boder?fane=kassen"
            className="flex min-h-[3.75rem] items-center gap-3 px-4 py-3 transition hover:bg-ink/[0.03]"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
              <Icon name="wallet" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">MobilePay og automatiske bøder</span>
              <span className="block text-sm text-ink/55">Findes i Bøder → Kassen</span>
            </span>
            <Icon name="chevron-right" className="h-4 w-4 text-ink/35" />
          </Link>
          <Link
            href="/dashboard/hold"
            className="flex min-h-[3.75rem] items-center gap-3 px-4 py-3 transition hover:bg-ink/[0.03]"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
              <Icon name="users" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">Medlemmer og invitation</span>
              <span className="block text-sm text-ink/55">Godkend, skift roller og del invitationslinket</span>
            </span>
            <Icon name="chevron-right" className="h-4 w-4 text-ink/35" />
          </Link>
        </ListGroup>
      </Section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/hold"
      className="inline-flex min-h-10 items-center gap-1 rounded-full pr-3 text-sm font-semibold text-ink/65 hover:text-ink"
    >
      <Icon name="chevron-left" className="h-5 w-5" />
      Hold
    </Link>
  );
}

/* ---------- Holdets tema ---------- */

function TeamTheme({ teamId, onSaved }: { teamId: string; onSaved: () => void }) {
  const { pushToast } = useToast();
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    let alive = true;
    fetch(`/api/team/${teamId}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => alive && setCurrent(data?.team?.themePreset ?? DEFAULT_THEME_ID))
      .catch(() => alive && setCurrent(DEFAULT_THEME_ID));
    return () => {
      alive = false;
    };
  }, [teamId]);

  async function choose(id: string) {
    if (id === current) return;
    setSaving(id);
    try {
      const response = await fetch(`/api/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: id, themeConfig: null })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke gemme", "error");
        return;
      }
      setCurrent(id);
      clearMeClientCache();
      onSaved();
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card className="space-y-3">
      <p className="text-sm text-ink/60">
        Standardfarver for alle på holdet. Hver spiller kan stadig vælge sine egne under sin profil.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_PRESETS.map((preset) => {
          const selected = current === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => choose(preset.id)}
              disabled={saving !== null || current === null}
              aria-pressed={selected}
              className={cn(
                "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-sm font-semibold transition active:scale-95",
                selected ? "border-moss bg-moss/10 text-ink" : "border-line text-ink/70 hover:bg-ink/[0.03]"
              )}
            >
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-surface"
                style={{ background: preset.swatch }}
              >
                {saving === preset.id ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                ) : selected ? (
                  <Icon name="check" className="h-4 w-4 text-white" strokeWidth={3} />
                ) : null}
              </span>
              {preset.label}
            </button>
          );
        })}
      </div>
      {current === "custom" ? (
        <p className="text-xs text-ink/50">Holdet bruger i dag egne farver. Vælg en profil ovenfor for at skifte.</p>
      ) : null}
    </Card>
  );
}

/* ---------- Holdkode ---------- */

function TeamSlugCard({ teamId, currentSlug }: { teamId: string; currentSlug: string }) {
  const { pushToast } = useToast();
  const { refreshDashboardTeam } = useDashboardTeam();
  const [slug, setSlug] = useState(currentSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSlug(currentSlug), [currentSlug]);

  const normalized = slugify(slug);
  const changed = normalized !== "" && normalized !== currentSlug;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!changed) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Kunne ikke gemme holdkoden");
        return;
      }
      clearMeClientCache();
      await refreshDashboardTeam();
      setSlug(data.team?.slug ?? slug);
      pushToast("Holdkoden er opdateret", "success");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save} className="space-y-3">
        <Field
          label="Holdkode"
          htmlFor="team-slug"
          hint="Bruges til at oprette sig og tilmelde sig holdet. Gamle invitationslinks med den tidligere kode holder op med at virke."
        >
          <input
            id="team-slug"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              setError(null);
            }}
            className={inputClass}
            maxLength={40}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        {changed && normalized ? (
          <p className="text-xs text-ink/55">
            Gemmes som <strong className="text-ink">{normalized}</strong>
          </p>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" loading={saving} disabled={!changed}>
          Gem holdkode
        </Button>
      </form>
    </Card>
  );
}

/* ---------- Kalender-import ---------- */

function CalendarImport({ teamId }: { teamId: string }) {
  const { pushToast } = useToast();
  const [feeds, setFeeds] = useState<Feed[] | null>(null);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"ical" | "xlsx" | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [feedToDelete, setFeedToDelete] = useState<Feed | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadFeeds() {
    if (!teamId) return;
    try {
      const response = await fetch(`/api/ical/import?teamId=${teamId}`, { cache: "no-store" });
      setFeeds(response.ok ? ((await response.json()).feeds ?? []) : []);
    } catch {
      setFeeds([]);
    }
  }

  useEffect(() => {
    void loadFeeds();
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function parse(response: Response) {
    const raw = await response.text();
    try {
      return JSON.parse(raw) as { error?: string; created?: number; updated?: number };
    } catch {
      return {} as { error?: string; created?: number; updated?: number };
    }
  }

  async function importIcal(event: React.FormEvent) {
    event.preventDefault();
    if (!teamId || !url.trim()) return;
    setBusy("ical");
    try {
      const response = await fetch("/api/ical/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, url })
      });
      const data = await parse(response);
      if (!response.ok) {
        pushToast(data.error ?? `Importen fejlede (${response.status})`, "error");
        return;
      }
      pushToast(`${data.created ?? 0} nye og ${data.updated ?? 0} opdaterede begivenheder`, "success");
      setUrl("");
      await loadFeeds();
    } finally {
      setBusy(null);
    }
  }

  async function refreshFeed(feed: Feed) {
    setRefreshingId(feed.id);
    try {
      const response = await fetch("/api/ical/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, url: feed.url, name: feed.name })
      });
      const data = await parse(response);
      if (!response.ok) {
        pushToast(data.error ?? `Importen fejlede (${response.status})`, "error");
        return;
      }
      pushToast(`${data.created ?? 0} nye og ${data.updated ?? 0} opdaterede begivenheder`, "success");
      await loadFeeds();
    } finally {
      setRefreshingId(null);
    }
  }

  async function deleteFeed() {
    if (!feedToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/ical/import?feedId=${encodeURIComponent(feedToDelete.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await parse(response);
        pushToast(data.error ?? "Kunne ikke slette importen", "error");
        return;
      }
      setFeeds((prev) => (prev ?? []).filter((feed) => feed.id !== feedToDelete.id));
      setFeedToDelete(null);
      pushToast("Importen er fjernet", "success");
    } finally {
      setDeleting(false);
    }
  }

  async function importXlsx(event: React.FormEvent) {
    event.preventDefault();
    if (!teamId || !file) return;
    setBusy("xlsx");
    try {
      const formData = new FormData();
      formData.append("teamId", teamId);
      formData.append("file", file);
      const response = await fetch("/api/ical/import-xlsx", { method: "POST", body: formData });
      const data = await parse(response);
      if (!response.ok) {
        pushToast(data.error ?? `Importen fejlede (${response.status})`, "error");
        return;
      }
      pushToast(`${data.created ?? 0} nye og ${data.updated ?? 0} opdaterede begivenheder`, "success");
      setFile(null);
      await loadFeeds();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-5">
      <form onSubmit={importIcal} className="space-y-3">
        <Field
          label="Link til kampprogram (iCal)"
          htmlFor="ical-url"
          hint="Fx fra DBU. Linket hentes automatisk igen, så flyttede kampe opdateres. Retter du en kamp selv, bliver din rettelse stående."
        >
          <input
            id="ical-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="webcal://ical.dbu.dk/Match.ashx?…"
            className={inputClass}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </Field>
        <Button type="submit" icon="calendar" loading={busy === "ical"} disabled={!url.trim()}>
          Hent kampe
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-ink/40">
        <span className="h-px flex-1 bg-ink/10" />
        eller
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <form onSubmit={importXlsx} className="space-y-3">
        <Field label="Excel-fil (.xlsx)" htmlFor="xlsx-file">
          <label
            htmlFor="xlsx-file"
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-ink/20 px-4 text-sm text-ink/60 transition hover:bg-ink/[0.03]"
          >
            <Icon name="share" className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">{file ? file.name : "Vælg en fil"}</span>
          </label>
          <input
            id="xlsx-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Button type="submit" variant="secondary" loading={busy === "xlsx"} disabled={!file}>
          Upload kampprogram
        </Button>
      </form>

      <div className="space-y-2 border-t border-line pt-4">
        <p className="text-sm font-semibold text-ink/80">Tidligere importer</p>
        {feeds === null ? (
          <p className="text-sm text-ink/50">Henter…</p>
        ) : feeds.length === 0 ? (
          <p className="text-sm text-ink/50">Ingen importer endnu.</p>
        ) : (
          <ul className="space-y-1.5">
            {feeds.map((feed) => (
              <li key={feed.id} className="rounded-2xl bg-ink/[0.04] px-4 py-3">
                <p className="font-semibold text-ink">{feed.name}</p>
                <p className="truncate text-xs text-ink/50">{feed.url}</p>
                <p className="mt-0.5 text-xs text-ink/45">
                  Sidst hentet {feed.lastImportedAt ? formatRelativePast(feed.lastImportedAt) : "aldrig"}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={refreshingId === feed.id}
                    onClick={() => refreshFeed(feed)}
                  >
                    Hent nu
                  </Button>
                  <Button type="button" size="sm" variant="ghost" icon="x" onClick={() => setFeedToDelete(feed)}>
                    Fjern
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmSheet
        open={feedToDelete !== null}
        onClose={() => setFeedToDelete(null)}
        onConfirm={deleteFeed}
        loading={deleting}
        title="Fjern import?"
        description="Importen forsvinder fra listen, og linket hentes ikke længere automatisk. Kampene bliver liggende i kalenderen."
        confirmLabel="Ja, fjern"
      />
    </Card>
  );
}
