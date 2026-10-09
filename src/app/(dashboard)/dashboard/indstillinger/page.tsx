"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { setCustomTheme, setTheme } from "@/components/ThemeProvider";
import { getStoredTeamId, setStoredTeamId } from "@/components/appState";
import { useToast } from "@/components/ToastProvider";
import PushSettings from "@/components/PushSettings";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import SeasonSettingsCard from "@/components/SeasonSettingsCard";
import LoadingButton from "@/components/LoadingButton";
import { invalidateDashboardTeam } from "@/components/DashboardTeamProvider";
import { clearMeClientCache } from "@/lib/meClientCache";
import { THEME_PRESETS } from "@/lib/themePresets";

type Membership = {
  role: string;
  team: { id: string; name: string; slug: string };
};

const presets = [
  ...THEME_PRESETS,
  {
    id: "custom",
    label: "Tilpasset",
    swatch: "conic-gradient(#0b84d8, #15803d, #e11d48, #f59e0b, #0b84d8)"
  }
];

export default function IndstillingerPage() {
  const { pushToast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [active, setActive] = useState("atlantic");
  const [hasUserTheme, setHasUserTheme] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [savingTeamTheme, setSavingTeamTheme] = useState(false);
  const [customTheme, setCustomThemeState] = useState({
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
  });
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [savingCustomTheme, setSavingCustomTheme] = useState(false);
  const [usingTeamTheme, setUsingTeamTheme] = useState(false);
  const [themeApplyingId, setThemeApplyingId] = useState<string | null>(null);
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState(false);

  useEffect(() => {
    setTeamId(getStoredTeamId());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("notice") === "pending_approval") {
      setPendingApprovalNotice(true);
    }
  }, []);

  useEffect(() => {
    async function loadMembershipsAndTheme() {
      if (!session?.user?.id) return;
      const response = await fetch("/api/me");
      if (!response.ok) return;
      const data = await response.json();
      const list = data.memberships ?? [];
      setMemberships(list);
      if (data.user) {
        setProfileName(data.user.name ?? "");
        setProfileEmail(data.user.email ?? "");
        setProfileImage(data.user.image ?? "");
      }

      let resolvedTeamId = teamId;
      if (list.length > 0) {
        const isCurrentValid = list.some((membership: Membership) => membership.team.id === teamId);
        if (!teamId || !isCurrentValid) {
          resolvedTeamId = list[0].team.id;
          setTeamId(resolvedTeamId);
          setStoredTeamId(resolvedTeamId);
        }
      }

      const userTheme = data.user?.themePreset ?? null;
      const userHasTheme = Boolean(userTheme);
      if (userHasTheme) {
        setHasUserTheme(true);
        setActive(userTheme);
        if (userTheme === "custom") {
          const config = data.user?.themeConfig ?? customTheme;
          setCustomThemeState((prev) => ({ ...prev, ...config }));
          setCustomTheme(config ?? customTheme);
        } else {
          setTheme(userTheme);
        }
      } else {
        setHasUserTheme(false);
      }
      if (!resolvedTeamId) return;
      const teamResponse = await fetch(`/api/team/${resolvedTeamId}`);
      if (!teamResponse.ok) return;
      const teamData = await teamResponse.json();
      if (!userHasTheme) {
        const teamTheme = teamData.team?.themePreset ?? "atlantic";
        setActive(teamTheme);
        if (teamTheme === "custom") {
          const config = teamData.team?.themeConfig ?? customTheme;
          setCustomThemeState((prev) => ({ ...prev, ...config }));
          setCustomTheme(config ?? customTheme);
        } else {
          setTheme(teamTheme);
        }
      }
    }

    loadMembershipsAndTheme();
  }, [session?.user?.id, teamId]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (session.user.hasActiveMembership) return;
    if (!session.user.hasPendingMembership) return;

    const interval = window.setInterval(async () => {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const list = data.memberships ?? [];
      if (!Array.isArray(list) || list.length === 0) return;

      setMemberships(list);
      const firstTeamId = list[0]?.team?.id ?? "";
      if (!firstTeamId) return;
      setTeamId(firstTeamId);
      setStoredTeamId(firstTeamId);
      invalidateDashboardTeam();
      pushToast("Du er blevet godkendt og sat på holdet automatisk.", "success");
      window.clearInterval(interval);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [pushToast, session?.user?.hasActiveMembership, session?.user?.hasPendingMembership, session?.user?.id]);

  async function handleTheme(theme: string) {
    if (themeApplyingId) return;
    setThemeApplyingId(theme);
    setActive(theme);
    setHasUserTheme(true);
    if (theme === "custom") {
      setCustomTheme(customTheme);
    } else {
      setTheme(theme);
    }
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themePreset: theme,
          ...(theme === "custom" ? { themeConfig: customTheme } : {})
        })
      });
      if (response.ok) clearMeClientCache();
    } catch {
      pushToast("Kunne ikke gemme tema", "error");
    } finally {
      setThemeApplyingId(null);
    }
  }

  async function handleSaveCustomTheme() {
    if (savingCustomTheme) return;
    setSavingCustomTheme(true);
    setHasUserTheme(true);
    setCustomTheme(customTheme);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: "custom", themeConfig: customTheme })
      });
      if (response.ok) clearMeClientCache();
    } finally {
      setSavingCustomTheme(false);
    }
  }

  async function handleUseTeamTheme() {
    if (usingTeamTheme) return;
    setUsingTeamTheme(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: null, themeConfig: null })
      });
      if (!response.ok) {
        pushToast("Kunne ikke skifte til holdets tema", "error");
        return;
      }
      clearMeClientCache();
      setHasUserTheme(false);
      if (!teamId) return;
      const teamResponse = await fetch(`/api/team/${teamId}`);
      if (!teamResponse.ok) return;
      const data = await teamResponse.json();
      const theme = data.team?.themePreset ?? "atlantic";
      setActive(theme);
      if (theme === "custom") {
        const config = data.team?.themeConfig ?? customTheme;
        setCustomThemeState((prev) => ({ ...prev, ...config }));
        setCustomTheme(config ?? customTheme);
      } else {
        setTheme(theme);
      }
    } finally {
      setUsingTeamTheme(false);
    }
  }

  useEffect(() => {
    if (active === "custom") {
      setCustomTheme(customTheme);
    }
  }, [active, customTheme]);

  useEffect(() => {
    if (active !== "custom" || !hasUserTheme) return;
    const timeout = setTimeout(() => {
      fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: "custom", themeConfig: customTheme })
      })
        .then((r) => {
          if (r.ok) clearMeClientCache();
        })
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timeout);
  }, [active, customTheme, hasUserTheme]);

  // Holdets standardtema kan også sættes herfra, så egne (tilpassede) farver kan gemmes som holdets standard.
  async function handleSaveTeamTheme() {
    if (!teamId || !isAdmin) return;
    setSavingTeamTheme(true);
    try {
      const response = await fetch(`/api/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themePreset: active,
          ...(active === "custom" ? { themeConfig: customTheme } : { themeConfig: null })
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme holdets tema", "error");
        return;
      }
      pushToast("Holdets standardtema er opdateret", "success");
    } finally {
      setSavingTeamTheme(false);
    }
  }

  function handleTeamChange(value: string) {
    setTeamId(value);
    setStoredTeamId(value);
  }

  const currentMembership = memberships.find((item) => item.team.id === teamId);
  const isAdmin = currentMembership?.role === "ADMIN";
  const canManageFineAutomation =
    currentMembership?.role === "ADMIN" || currentMembership?.role === "BOEDEKASSEFORMAND";
  const inviteSlug = currentMembership?.team.slug ?? "";
  const passwordValidationMessage =
    newPassword && newPassword.length < 6
      ? "Ny adgangskode skal være mindst 6 tegn."
      : newPassword && newPassword !== confirmPassword
      ? "Adgangskoderne matcher ikke."
      : null;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  }

  async function handleProfileSave(event: React.FormEvent) {
    event.preventDefault();
    if (profileSaving) return;
    if (newPassword && newPassword.length < 6) {
      pushToast("Ny adgangskode skal være mindst 6 tegn.", "error");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      pushToast("Adgangskoderne matcher ikke.", "error");
      return;
    }

    setProfileSaving(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail ? profileEmail.toLowerCase() : null,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke opdatere profil", "error");
        return;
      }

      pushToast("Profil opdateret.", "success");
      clearMeClientCache();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/me/avatar", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke uploade profilbillede", "error");
        return;
      }
      setProfileImage(data.url);
      clearMeClientCache();
      pushToast("Profilbillede opdateret.", "success");
    } finally {
      setUploading(false);
    }
  }

  if (sessionStatus === "loading") {
    return (
      <section className="w-full min-w-0 space-y-6">
        <header className="page-header">
          <h2>Indstillinger</h2>
          <p className="mt-2 text-ink/70">Indlæser...</p>
        </header>
      </section>
    );
  }

  if (!session?.user?.id) {
    return (
      <section className="w-full min-w-0 space-y-6">
        <header className="page-header">
          <h2>Indstillinger</h2>
          <p className="mt-2 text-ink/70">Du skal være logget ind for at se indstillinger.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="w-full min-w-0 space-y-6">
      <header className="page-header">
        <h2>Indstillinger</h2>
        <p className="mt-2 text-ink/70">Team, roller og integrationsindstillinger.</p>
        {pendingApprovalNotice ? (
          <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
            Din bruger afventer godkendelse. Du kan allerede nu aktivere push-notifikationer her i Indstillinger.
          </p>
        ) : null}
      </header>

      <CollapsibleCard
        title="Profil"
        description="Opdater dine oplysninger og adgangskode."
        storageKey={`holdbold:settings:${session.user.id}:profil`}
        headerEnd={
          <LoadingButton
            type="button"
            className="btn-ghost"
            onClick={handleSignOut}
            isLoading={signingOut}
            idleContent="Log ud"
            loadingContent="Logger ud..."
          />
        }
      >
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleProfileSave}>
          <div className="space-y-2 lg:col-span-2">
            <div className="flex items-center gap-4">
              {/* Tryk på billedet for at skifte det – blyanten viser, at det kan redigeres. */}
              <label
                htmlFor="profile-avatar"
                aria-label={profileImage ? "Skift profilbillede" : "Tilføj profilbillede"}
                className={`group relative block h-24 w-24 shrink-0 cursor-pointer rounded-full ring-2 ring-line transition active:scale-95 ${
                  uploading ? "pointer-events-none" : ""
                }`}
              >
                <Avatar name={profileName || session.user.name} image={profileImage || null} size="xl" className="h-24 w-24 text-3xl" />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition group-hover:bg-black/25">
                  {uploading ? <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/40 border-t-white" /> : null}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-md)] ring-[3px] ring-surface">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </span>
              </label>
              <div className="min-w-0">
                <p className="font-semibold text-ink">Profilbillede</p>
                <p className="text-sm text-ink/55">
                  {uploading ? "Uploader…" : profileImage ? "Tryk på billedet for at skifte det." : "Tryk på cirklen for at tilføje et billede."}
                </p>
              </div>
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  handleAvatarUpload(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
                className="sr-only"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="profile-name">Navn</label>
            <input
              id="profile-name"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value.toLowerCase())}
              className="input"
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="current-password">Nuværende adgangskode</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="new-password">Ny adgangskode</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="confirm-password">Gentag ny adgangskode</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="input"
            />
            {passwordValidationMessage ? (
              <p className="text-xs font-semibold text-danger">{passwordValidationMessage}</p>
            ) : null}
          </div>
          <div className="flex items-end gap-3">
            <LoadingButton
              type="submit"
              className="btn-primary"
              isLoading={profileSaving}
              idleContent="Gem profil"
              loadingContent="Gemmer..."
            />
          </div>
        </form>
      </CollapsibleCard>

      <CollapsibleCard title="Push-notifikationer" storageKey={`holdbold:settings:${session.user.id}:push`}>
        <PushSettings />
      </CollapsibleCard>

      {canManageFineAutomation && teamId ? (
        <Link
          href="/dashboard/boder?fane=kassen"
          className="card flex items-center justify-between gap-3 transition hover:border-ink/20"
        >
          <span>
            <span className="block text-lg font-bold text-ink">Automatiske bøder</span>
            <span className="block text-sm text-ink/60">Er flyttet til Bøder → Kassen.</span>
          </span>
          <span aria-hidden className="text-ink/40">›</span>
        </Link>
      ) : null}

      <div className="grid w-full min-w-0 gap-6 lg:grid-cols-2">
        <CollapsibleCard
          title="Tema"
          description="Vælg en farveprofil for dashboardet."
          storageKey={`holdbold:settings:${session.user.id}:tema:${teamId || "none"}`}
        >
          <p className="text-xs text-ink/60">
            {hasUserTheme ? "Du bruger dit personlige tema." : "Du bruger holdets standardtema."}
          </p>
          <div className="mt-4 grid w-full min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-2">
            {presets.map((preset) => {
              const selected = (presets.some((item) => item.id === active) ? active : "atlantic") === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleTheme(preset.id)}
                  disabled={themeApplyingId !== null}
                  aria-pressed={selected}
                  className={`flex min-h-[3.25rem] w-full min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-sm font-semibold transition active:scale-[0.98] ${
                    selected ? "border-moss bg-moss/10 ring-1 ring-moss" : "border-ink/10 bg-surface hover:bg-surface-2"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-6 w-6 shrink-0 rounded-full ring-2 ring-surface"
                    style={{ background: preset.swatch }}
                  />
                  <span className="truncate">{themeApplyingId === preset.id ? "Gemmer..." : preset.label}</span>
                </button>
              );
            })}
          </div>
          {hasUserTheme ? (
            <div className="mt-4 w-full">
              <LoadingButton
                type="button"
                className="btn-ghost w-full min-[480px]:w-auto"
                onClick={handleUseTeamTheme}
                isLoading={usingTeamTheme}
                idleContent="Brug holdets standardtema"
                loadingContent="Skifter..."
              />
            </div>
          ) : null}
          {isAdmin ? (
            <div className="mt-3 w-full">
              <button
                type="button"
                className="btn-ghost w-full min-[480px]:w-auto"
                onClick={handleSaveTeamTheme}
                disabled={savingTeamTheme || !teamId}
              >
                {savingTeamTheme ? "Gemmer..." : "Sæt som holdets standardtema"}
              </button>
            </div>
          ) : null}
          {active === "custom" ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: "ink", label: "Tekst" },
                  { key: "clay", label: "Kantfarve" },
                  { key: "moss", label: "Accent" },
                  { key: "ember", label: "Highlight" },
                  { key: "fog", label: "Kortbaggrund" },
                  { key: "button", label: "Knap baggrund" },
                  { key: "buttonText", label: "Knap tekst" }
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex w-full min-w-0 items-center justify-between rounded-2xl border border-ink/10 bg-surface/80 px-4 py-3 text-sm font-semibold text-ink/80"
                  >
                    <span>{item.label}</span>
                    <input
                      type="color"
                      value={(customTheme as Record<string, string>)[item.key]}
                      onChange={(event) =>
                        setCustomThemeState((prev) => ({ ...prev, [item.key]: event.target.value }))
                      }
                      className="h-8 w-12 cursor-pointer rounded-lg border border-ink/10 bg-surface"
                    />
                  </label>
                ))}
              </div>
              <LoadingButton
                type="button"
                className="btn-primary w-full sm:w-auto"
                onClick={handleSaveCustomTheme}
                isLoading={savingCustomTheme}
                idleContent="Gem tilpasset tema"
                loadingContent="Gemmer..."
              />
            </div>
          ) : null}
        </CollapsibleCard>
      </div>

      {teamId ? (
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">Skade og fravær</h3>
            <p className="text-sm text-ink/70">Meld dig fraværende over længere tid, så du automatisk meldes fra begivenheder.</p>
          </div>
          <Link href="/dashboard/fravaer" className="btn-ghost">Åbn fravær</Link>
        </section>
      ) : null}


      {teamId ? (
        <SeasonSettingsCard
          teamId={teamId}
          isAdmin={isAdmin}
          storageKey={`holdbold:settings:${session.user.id}:saeson:${teamId}`}
        />
      ) : null}

      {isAdmin && teamId ? (
        <Link
          href="/dashboard/hold/indstillinger"
          className="card flex items-center justify-between gap-3 transition hover:border-ink/20"
        >
          <span>
            <span className="block text-lg font-bold text-ink">Holdindstillinger</span>
            <span className="block text-sm text-ink/60">Holdets farver, kampprogram og OpenAI-nøgle.</span>
          </span>
          <span aria-hidden className="text-ink/40">›</span>
        </Link>
      ) : null}

    </section>
  );
}
