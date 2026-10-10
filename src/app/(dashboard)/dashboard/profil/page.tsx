"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { setCustomTheme, setTheme } from "@/components/ThemeProvider";
import { clearStoredTheme, getStoredTeamId, setStoredTeamId } from "@/components/appState";
import { useToast } from "@/components/ToastProvider";
import { invalidateDashboardTeam, useDashboardTeam } from "@/components/DashboardTeamProvider";
import CalendarFeedSettings from "@/components/CalendarFeedSettings";
import PushSettings from "@/components/PushSettings";
import { SetupGuideBanner, SetupGuideRow } from "@/components/SetupGuide";
import GuideRow from "@/components/guide/GuideRow";
import { SeasonViewerCard } from "@/components/SeasonSettingsCard";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { Card, Chip, Field, ListGroup, ListRow, Section, Skeleton, inputClass } from "@/components/ui/primitives";
import { clearMeClientCache } from "@/lib/meClientCache";
import { rolesLabel } from "@/lib/roleLabels";
import { FINE_MANAGER_ROLES, hasAnyRole, isAdminRoles } from "@/lib/roles";
import { DEFAULT_THEME_ID, THEME_PRESETS } from "@/lib/themePresets";

type Membership = {
  roles: string[];
  status?: string;
  team: { id: string; name: string; slug: string };
};

type CustomTheme = Record<string, string>;

const DEFAULT_CUSTOM: CustomTheme = {
  ink: "#0f172a",
  clay: "#cbd5e1",
  moss: "#0f766e",
  ember: "#d97706",
  fog: "#f8fafc",
  button: "#0f172a",
  buttonText: "#f8fafc",
  gradientStart: "#f8fafc",
  gradientMid: "#eef2f7",
  gradientEnd: "#e2e8f0"
};

const CUSTOM_FIELDS = [
  { key: "moss", label: "Hovedfarve" },
  { key: "button", label: "Knapper" },
  { key: "buttonText", label: "Tekst på knapper" },
  { key: "ember", label: "Fremhævning" },
  { key: "ink", label: "Tekst" },
  { key: "clay", label: "Kanter" },
  { key: "fog", label: "Kort" }
];

const PRESETS = [
  ...THEME_PRESETS,
  {
    id: "custom",
    label: "Tilpasset",
    swatch: "conic-gradient(#0b84d8, #15803d, #e11d48, #f59e0b, #0b84d8)"
  }
];

function LinkRow({ href, icon, title, subtitle }: { href: string; icon: IconName; title: string; subtitle: string }) {
  return (
    <ListRow
      href={href}
      chevron
      leading={
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
          <Icon name={icon} />
        </span>
      }
      title={title}
      subtitle={subtitle}
    />
  );
}

export default function ProfilPage() {
  const { pushToast } = useToast();
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
  const [loaded, setLoaded] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [pendingMemberships, setPendingMemberships] = useState<Membership[]>([]);
  const [teamId, setTeamId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [active, setActive] = useState<string>(DEFAULT_THEME_ID);
  const [hasUserTheme, setHasUserTheme] = useState(false);
  const [customTheme, setCustomThemeState] = useState<CustomTheme>(DEFAULT_CUSTOM);
  const [customOpen, setCustomOpen] = useState(false);
  const [themeBusy, setThemeBusy] = useState<string | null>(null);

  useEffect(() => {
    setTeamId(getStoredTeamId());
  }, []);

  function applyTheme(theme: string, config?: CustomTheme | null) {
    if (theme === "custom") {
      const merged = { ...DEFAULT_CUSTOM, ...(config ?? {}) };
      setCustomThemeState(merged);
      setCustomTheme(merged);
    } else {
      setTheme(theme);
    }
    setActive(theme);
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    let alive = true;
    (async () => {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok || !alive) return;
      const data = await response.json();
      const list: Membership[] = data.memberships ?? [];
      const pendingList: Membership[] = data.pendingMemberships ?? [];
      setMemberships(list);
      setPendingMemberships(pendingList);
      if (data.user) {
        setName(data.user.name ?? "");
        setEmail(data.user.email ?? "");
        setImage(data.user.image ?? "");
      }
      let resolvedTeamId = getStoredTeamId();
      if (
        list.length > 0 &&
        !list.some((item) => item.team.id === resolvedTeamId) &&
        !pendingList.some((item) => item.team.id === resolvedTeamId)
      ) {
        resolvedTeamId = list[0].team.id;
        setStoredTeamId(resolvedTeamId);
      }
      setTeamId(resolvedTeamId);

      const userTheme: string | null = data.user?.themePreset ?? null;
      if (userTheme) {
        setHasUserTheme(true);
        applyTheme(userTheme, data.user?.themeConfig);
      } else {
        setHasUserTheme(false);
        if (resolvedTeamId) {
          const teamResponse = await fetch(`/api/team/${resolvedTeamId}`);
          if (teamResponse.ok && alive) {
            const teamData = await teamResponse.json();
            applyTheme(teamData.team?.themePreset ?? DEFAULT_THEME_ID, teamData.team?.themeConfig);
          }
        }
      }
      if (alive) setLoaded(true);
    })().catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Venter på godkendelse: tjek jævnligt, om man er kommet på holdet.
  const { teamPending, teamId: dashboardTeamId } = useDashboardTeam();
  const waiting =
    Boolean(session?.user?.id) &&
    ((!session?.user?.hasActiveMembership && Boolean(session?.user?.hasPendingMembership)) || teamPending);
  useEffect(() => {
    if (!waiting) return;
    const interval = window.setInterval(async () => {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const list: Membership[] = data.memberships ?? [];
      if (list.length === 0) return;
      // Ved et ekstra hold afventer vi netop det hold, brugeren kigger på.
      const approved = teamPending ? list.find((m) => m.team.id === dashboardTeamId) : list[0];
      if (!approved) return;
      setMemberships(list);
      setStoredTeamId(approved.team.id);
      setTeamId(approved.team.id);
      clearMeClientCache();
      invalidateDashboardTeam();
      await updateSession?.();
      pushToast("Du er kommet på holdet – velkommen!", "success");
      window.clearInterval(interval);
      window.location.href = "/dashboard";
    }, 15000);
    return () => window.clearInterval(interval);
  }, [waiting, teamPending, dashboardTeamId, pushToast, updateSession]);

  // Tilpasset tema gemmes automatisk, mens man justerer farverne.
  useEffect(() => {
    if (active !== "custom" || !hasUserTheme) return;
    setCustomTheme(customTheme);
    const timeout = setTimeout(() => {
      fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: "custom", themeConfig: customTheme })
      })
        .then((r) => r.ok && clearMeClientCache())
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timeout);
  }, [active, customTheme, hasUserTheme]);

  async function chooseTheme(id: string) {
    if (themeBusy) return;
    setThemeBusy(id);
    setHasUserTheme(true);
    applyTheme(id, customTheme);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: id, ...(id === "custom" ? { themeConfig: customTheme } : {}) })
      });
      if (response.ok) clearMeClientCache();
      else pushToast("Kunne ikke gemme farverne", "error");
    } catch {
      pushToast("Kunne ikke gemme farverne", "error");
    } finally {
      setThemeBusy(null);
    }
    if (id === "custom") setCustomOpen(true);
  }

  async function useTeamTheme() {
    if (themeBusy) return;
    setThemeBusy("team");
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: null, themeConfig: null })
      });
      if (!response.ok) {
        pushToast("Kunne ikke skifte til holdets farver", "error");
        return;
      }
      clearMeClientCache();
      setHasUserTheme(false);
      if (!teamId) return;
      const teamResponse = await fetch(`/api/team/${teamId}`);
      if (!teamResponse.ok) return;
      const data = await teamResponse.json();
      applyTheme(data.team?.themePreset ?? DEFAULT_THEME_ID, data.team?.themeConfig);
      pushToast("Du bruger nu holdets farver", "success");
    } finally {
      setThemeBusy(null);
    }
  }

  async function saveInfo(event: React.FormEvent) {
    event.preventDefault();
    if (infoSaving) return;
    setInfoSaving(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email ? email.toLowerCase() : null })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme dine oplysninger", "error");
        return;
      }
      clearMeClientCache();
      invalidateDashboardTeam();
      pushToast("Dine oplysninger er gemt", "success");
      setInfoOpen(false);
    } finally {
      setInfoSaving(false);
    }
  }

  const passwordError =
    newPassword && newPassword.length < 6
      ? "Mindst 6 tegn"
      : confirmPassword && newPassword !== confirmPassword
      ? "Adgangskoderne er ikke ens"
      : null;

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (passwordSaving || passwordError || !newPassword) return;
    setPasswordSaving(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPassword || undefined, newPassword })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke skifte adgangskode", "error");
        return;
      }
      pushToast("Din adgangskode er skiftet", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function uploadAvatar(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/me/avatar", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke uploade billedet", "error");
        return;
      }
      setImage(data.url);
      clearMeClientCache();
      invalidateDashboardTeam();
      pushToast("Profilbillede opdateret", "success");
    } finally {
      setUploading(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    clearStoredTheme();
    await signOut({ callbackUrl: "/login" });
  }

  if (sessionStatus === "loading") {
    return (
      <div className="space-y-4 pt-2">
        <Skeleton className="h-44 rounded-[1.75rem]" />
        <Skeleton className="h-32 rounded-[1.375rem]" />
      </div>
    );
  }

  if (!session?.user?.id) {
    return <p className="pt-4 text-ink/70">Du skal være logget ind for at se din profil.</p>;
  }

  const membership =
    memberships.find((item) => item.team.id === teamId) ??
    pendingMemberships.find((item) => item.team.id === teamId) ??
    memberships[0];
  const isAdmin = isAdminRoles(membership?.roles) && membership.status !== "PENDING";
  const canManageFines = hasAnyRole(membership?.roles, FINE_MANAGER_ROLES) && membership.status !== "PENDING";
  const displayName = name || session.user.name || "Dig";
  const selectedPreset = PRESETS.some((item) => item.id === active) ? active : DEFAULT_THEME_ID;

  return (
    <div className="space-y-7 pb-8 pt-1">
      {/* Hero med profilbillede */}
      <div className="hero-surface relative overflow-hidden rounded-[1.75rem] px-5 pb-6 pt-7 text-on-primary">
        <div className="relative flex flex-col items-center text-center">
          <label
            htmlFor="profile-avatar"
            aria-label={image ? "Skift profilbillede" : "Tilføj profilbillede"}
            className={cn(
              "group relative block h-28 w-28 cursor-pointer rounded-full ring-4 ring-on-primary/30 transition active:scale-95",
              uploading && "pointer-events-none"
            )}
          >
            <Avatar name={displayName} image={image || null} size="xl" className="h-28 w-28 text-4xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition group-hover:bg-black/25">
              {uploading ? (
                <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
              ) : null}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-md)] ring-[3px] ring-primary">
              <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
          </label>
          <input
            id="profile-avatar"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              void uploadAvatar(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <h1 className="mt-4 font-display text-3xl font-extrabold uppercase leading-none tracking-tight">{displayName}</h1>
          {email ? <p className="mt-1 text-sm text-on-primary/75">{email}</p> : null}
          {membership ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-on-primary/15 px-3.5 py-1.5 text-sm font-semibold">
              {membership.team.name}
              <span className="opacity-60">·</span>
              {membership.status === "PENDING" ? "Afventer" : rolesLabel(membership.roles)}
            </p>
          ) : null}
        </div>
      </div>

      {waiting ? (
        <Card className="flex items-start gap-3 border-pending/30 bg-pending/10">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pending/15 text-pending">
            <Icon name="hourglass" />
          </span>
          <div>
            <p className="font-display text-xl font-bold uppercase leading-tight">Vi venter på godkendelse</p>
            <p className="mt-1 text-sm text-ink/70">
              En admin skal lige godkende dig, før du kommer ind på holdet. Du kan allerede nu rette din profil og slå
              push til, så du får besked med det samme. Siden tjekker selv, om du er kommet på.
            </p>
          </div>
        </Card>
      ) : null}

      <SetupGuideBanner />

      {waiting ? null : (
        <Section title="Guide">
          <ListGroup>
            <GuideRow />
          </ListGroup>
        </Section>
      )}

      <Section title="Konto">
        <ListGroup>
          <ListRow
            onClick={() => setInfoOpen(true)}
            chevron
            leading={
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
                <Icon name="user" />
              </span>
            }
            title="Dine oplysninger"
            subtitle="Navn og email"
          />
          <ListRow
            onClick={() => setPasswordOpen(true)}
            chevron
            leading={
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
                <Icon name="settings" />
              </span>
            }
            title="Skift adgangskode"
            subtitle="Vælg en ny adgangskode"
          />
        </ListGroup>
      </Section>

      <Section title="Notifikationer">
        <ListGroup>
          <PushSettings />
          <SetupGuideRow />
          <LinkRow href="/dashboard/notifikationer" icon="bell" title="Se alle notifikationer" subtitle="Dit seneste overblik" />
        </ListGroup>
      </Section>

      {waiting ? null : (
        <Section title="Kalender">
          <ListGroup>
            <CalendarFeedSettings />
          </ListGroup>
        </Section>
      )}

      <Section title="Udseende">
        <Card className="space-y-4">
          <p className="text-sm text-ink/60">
            {hasUserTheme ? "Dine egne farver. Kun du ser dem." : "Du bruger holdets farver. Vælg selv for at ændre dem for dig."}
          </p>
          {!loaded ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="grid grid-cols-5 gap-2.5">
              {PRESETS.map((preset) => {
                const selected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => chooseTheme(preset.id)}
                    disabled={themeBusy !== null}
                    aria-pressed={selected}
                    aria-label={preset.label}
                    className="group flex flex-col items-center gap-1.5 active:scale-95"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex h-12 w-12 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition",
                        selected ? "ring-2 ring-ink" : "ring-1 ring-line"
                      )}
                      style={{ background: preset.swatch }}
                    >
                      {themeBusy === preset.id ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                      ) : selected ? (
                        <Icon name="check" className="h-5 w-5 text-white drop-shadow" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className={cn("text-[0.7rem] font-semibold", selected ? "text-ink" : "text-ink/55")}>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {selectedPreset === "custom" && hasUserTheme ? (
              <Button variant="secondary" size="sm" onClick={() => setCustomOpen(true)}>
                Tilpas farver
              </Button>
            ) : null}
            {hasUserTheme ? (
              <Button variant="ghost" size="sm" onClick={useTeamTheme} loading={themeBusy === "team"}>
                Brug holdets farver
              </Button>
            ) : null}
          </div>
        </Card>
      </Section>

      <SeasonViewerCard />

      {membership && !waiting ? (
        <Section title={membership.team.name}>
          <ListGroup>
            <LinkRow href="/dashboard/fravaer" icon="heart" title="Skade og fravær" subtitle="Meld dig fra over længere tid" />
            {canManageFines ? (
              <LinkRow href="/dashboard/boder?fane=kassen" icon="wallet" title="Bødekassen" subtitle="MobilePay, skabeloner og automatiske bøder" />
            ) : null}
            {isAdmin ? (
              <LinkRow href="/dashboard/hold/indstillinger" icon="settings" title="Holdindstillinger" subtitle="Farver, kampprogram, sæson og OpenAI-nøgle" />
            ) : null}
          </ListGroup>
        </Section>
      ) : null}

      <Button block variant="secondary" icon="x" onClick={handleSignOut} loading={signingOut}>
        Log ud
      </Button>

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} dismissible={!infoSaving} title="Dine oplysninger">
        <form onSubmit={saveInfo} className="space-y-4">
          <Field label="Navn" htmlFor="profile-name">
            <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoComplete="name" />
          </Field>
          <Field label="Email" htmlFor="profile-email">
            <input
              id="profile-email"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              className={inputClass}
              autoComplete="email"
            />
          </Field>
          <Button type="submit" block loading={infoSaving} disabled={!name.trim()}>
            Gem
          </Button>
        </form>
      </Sheet>

      <Sheet open={passwordOpen} onClose={() => setPasswordOpen(false)} dismissible={!passwordSaving} title="Skift adgangskode">
        <form onSubmit={savePassword} className="space-y-4">
          <Field label="Nuværende adgangskode" htmlFor="current-password">
            <input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} autoComplete="current-password" />
          </Field>
          <Field label="Ny adgangskode" htmlFor="new-password">
            <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
          </Field>
          <Field label="Gentag ny adgangskode" htmlFor="confirm-password" error={passwordError}>
            <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
          </Field>
          <Button type="submit" block loading={passwordSaving} disabled={!newPassword || Boolean(passwordError)}>
            Skift adgangskode
          </Button>
        </form>
      </Sheet>

      <Sheet open={customOpen} onClose={() => setCustomOpen(false)} title="Tilpas farver" description="Ændringerne gemmes automatisk.">
        <ul className="space-y-2">
          {CUSTOM_FIELDS.map((item) => (
            <li key={item.key}>
              <label className="flex min-h-14 items-center justify-between rounded-2xl border border-line px-4 text-sm font-semibold text-ink/80">
                {item.label}
                <input
                  type="color"
                  value={customTheme[item.key]}
                  onChange={(event) => setCustomThemeState((prev) => ({ ...prev, [item.key]: event.target.value }))}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-line bg-surface"
                />
              </label>
            </li>
          ))}
        </ul>
        <Chip className="mt-3">Kun synlig for dig</Chip>
      </Sheet>
    </div>
  );
}
