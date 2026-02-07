"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { setCustomTheme, setTheme } from "@/components/ThemeProvider";
import { getStoredTeamId, setStoredTeamId } from "@/components/appState";
import { useToast } from "@/components/ToastProvider";

type Membership = {
  role: string;
  team: { id: string; name: string; slug: string };
};

type TeamMember = {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    image?: string | null;
  };
};

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  TRAENER: "Træner",
  SPILLER: "Spiller",
  BOEDEKASSEFORMAND: "Bødekasseformand"
};

const presets = [
  { id: "atlantic", label: "Atlantic" },
  { id: "sandstone", label: "Sandstone" },
  { id: "forest", label: "Forest" },
  { id: "midnight", label: "Midnight" },
  { id: "mono", label: "Mono" },
  { id: "crimson", label: "Crimson" },
  { id: "ocean", label: "Ocean" },
  { id: "lavender", label: "Lavender" },
  { id: "sunset", label: "Sunset" },
  { id: "citrus", label: "Citrus" },
  { id: "neon", label: "Neon" },
  { id: "custom", label: "Tilpasset" }
];

export default function IndstillingerPage() {
  const { pushToast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [active, setActive] = useState("atlantic");
  const [teamId, setTeamId] = useState("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberRole, setMemberRole] = useState("SPILLER");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const [profilePhone, setProfilePhone] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setTeamId(getStoredTeamId());
  }, []);

  useEffect(() => {
    async function loadMemberships() {
      if (!session?.user?.id) return;
      const response = await fetch("/api/me");
      if (!response.ok) return;
      const data = await response.json();
      const list = data.memberships ?? [];
      setMemberships(list);
      if (data.user) {
        setProfileName(data.user.name ?? "");
        setProfileEmail(data.user.email ?? "");
        setProfilePhone(data.user.phone ?? "");
        setProfileImage(data.user.image ?? "");
      }
      if (!teamId && list.length > 0) {
        setTeamId(list[0].team.id);
        setStoredTeamId(list[0].team.id);
      }
    }

    async function loadTeam() {
      if (!teamId) return;
      const response = await fetch(`/api/team/${teamId}`);
      if (!response.ok) return;
      const data = await response.json();
      const theme = data.team?.themePreset ?? "atlantic";
      setActive(theme);
      if (theme === "custom") {
        const config = data.team?.themeConfig ?? customTheme;
        setCustomThemeState((prev) => ({ ...prev, ...config }));
        setCustomTheme(config ?? customTheme);
      } else {
        setTheme(theme);
      }
    }

    loadMemberships();
    loadTeam();
  }, [session?.user?.id, teamId]);

  useEffect(() => {
    async function loadTeamMembers() {
      if (!teamId) return;
      const response = await fetch(`/api/team-members?teamId=${teamId}`);
      if (!response.ok) return;
      const data = await response.json();
      setTeamMembers(data.members ?? []);
    }

    loadTeamMembers();
  }, [teamId]);

  function handleTheme(theme: string) {
    setActive(theme);
    if (!teamId) return;
    if (theme === "custom") {
      setCustomTheme(customTheme);
    } else {
      setTheme(theme);
    }
    fetch(`/api/team/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themePreset: theme })
    }).catch(() => undefined);
  }

  async function handleSaveCustomTheme() {
    if (!teamId) return;
    setCustomTheme(customTheme);
    await fetch(`/api/team/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themePreset: "custom", themeConfig: customTheme })
    });
  }

  useEffect(() => {
    if (active === "custom") {
      setCustomTheme(customTheme);
    }
  }, [active, customTheme]);

  useEffect(() => {
    if (active !== "custom" || !teamId) return;
    const timeout = setTimeout(() => {
      fetch(`/api/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: "custom", themeConfig: customTheme })
      }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(timeout);
  }, [active, teamId, customTheme]);

  function handleTeamChange(value: string) {
    setTeamId(value);
    setStoredTeamId(value);
  }

  const currentMembership = memberships.find((item) => item.team.id === teamId);
  const isAdmin = currentMembership?.role === "ADMIN";

  async function handleUpdateRole() {
    if (!selectedMember) return;
    const response = await fetch(`/api/team-members/${selectedMember.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: memberRole })
    });
    const data = await response.json();
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke opdatere rolle", "error");
      return;
    }
    setTeamMembers((prev) => prev.map((m) => (m.id === selectedMember.id ? { ...m, role: data.membership.role } : m)));
    setSelectedMember((prev) => (prev ? { ...prev, role: data.membership.role } : prev));
    pushToast("Rolle opdateret", "success");
  }

  async function handleDeleteMember() {
    if (!selectedMember) return;
    const response = await fetch(`/api/team-members/${selectedMember.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke fjerne bruger", "error");
      return;
    }
    setTeamMembers((prev) => prev.filter((m) => m.id !== selectedMember.id));
    setSelectedMember(null);
    pushToast(data.warning ?? "Bruger fjernet", "success");
  }

  function confirmDeleteMember() {
    if (!selectedMember) return;
    setShowDeleteConfirm(true);
  }

  async function handleProfileSave(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      pushToast("Adgangskoderne matcher ikke.", "error");
      return;
    }

    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profileName,
        email: profileEmail || null,
        phone: profilePhone || null,
        image: profileImage || null,
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
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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
      pushToast("Profilbillede opdateret.", "success");
    } finally {
      setUploading(false);
    }
  }

  if (sessionStatus === "loading") {
    return (
      <section className="space-y-6">
        <header className="card">
          <h2 className="text-2xl font-semibold text-ink">Indstillinger</h2>
          <p className="mt-2 text-ink/70">Indlæser...</p>
        </header>
      </section>
    );
  }

  if (!session?.user?.id) {
    return (
      <section className="space-y-6">
        <header className="card">
          <h2 className="text-2xl font-semibold text-ink">Indstillinger</h2>
          <p className="mt-2 text-ink/70">Du skal være logget ind for at se indstillinger.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="card">
        <h2 className="text-2xl font-semibold text-ink">Indstillinger</h2>
        <p className="mt-2 text-ink/70">Team, roller og integrationsindstillinger.</p>
      </header>

      <div className="card-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">Profil</h3>
            <p className="mt-2 text-sm text-ink/70">Opdater dine oplysninger og adgangskode.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
            Log ud
          </button>
        </div>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={handleProfileSave}>
          <div className="space-y-2 lg:col-span-2">
            <label className="label" htmlFor="profile-avatar">Profilbillede</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-ink/10 bg-white/80">
                {profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileImage} alt="Profilbillede" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <label
                htmlFor="profile-avatar"
                className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-4 text-sm text-ink/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:flex-1"
              >
                <span className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-fog">
                  Vælg fil
                </span>
                <span className="truncate text-ink/60">
                  {profileImage ? "Profilbillede valgt" : "Der er ikke valgt nogen fil"}
                </span>
              </label>
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={(event) => handleAvatarUpload(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>
            {uploading ? <p className="text-xs text-ink/60">Uploader...</p> : null}
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
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="profile-phone">Telefon</label>
            <input
              id="profile-phone"
              value={profilePhone}
              onChange={(event) => setProfilePhone(event.target.value)}
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
          </div>
          <div className="flex items-end gap-3">
            <button type="submit" className="btn-primary">
              Gem profil
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Hold</h3>
          <p className="mt-2 text-sm text-ink/70">Vælg hvilket hold du arbejder i.</p>
          <div className="mt-4 grid gap-3">
            <select value={teamId} onChange={(event) => handleTeamChange(event.target.value)} className="input">
              <option value="">Vælg hold</option>
              {memberships.map((membership) => (
                <option key={membership.team.id} value={membership.team.id}>
                  {membership.team.name} ({membership.role})
                </option>
              ))}
            </select>
          </div>
          <div className="mt-6 space-y-3">
            <p className="label">Spillere</p>
            <div className="space-y-2">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-ink/60">Ingen medlemmer fundet.</p>
              ) : (
                teamMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setSelectedMember(member);
                      setMemberRole(member.role);
                    }}
                    className="flex w-full items-center justify-between rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-left hover:border-ink/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-ink/10 bg-white">
                        {member.user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.user.image} alt={member.user.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-ink">{member.user.name}</div>
                        <div className="text-xs text-ink/60">{member.user.email ?? "Ingen email"}</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/70">
                      {roleLabels[member.role] ?? member.role}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Tema</h3>
          <p className="mt-2 text-sm text-ink/70">Vælg en farveprofil for dashboardet.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleTheme(preset.id)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                  active === preset.id ? "border-ink bg-white" : "border-ink/10 bg-white/70"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
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
                  { key: "buttonText", label: "Knap tekst" },
                  { key: "gradientStart", label: "Baggrund start" },
                  { key: "gradientMid", label: "Baggrund midt" },
                  { key: "gradientEnd", label: "Baggrund slut" }
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm font-semibold text-ink/80">
                    <span>{item.label}</span>
                    <input
                      type="color"
                      value={(customTheme as Record<string, string>)[item.key]}
                      onChange={(event) =>
                        setCustomThemeState((prev) => ({ ...prev, [item.key]: event.target.value }))
                      }
                      className="h-8 w-12 cursor-pointer rounded-lg border border-ink/10 bg-white"
                    />
                  </label>
                ))}
              </div>
              <button type="button" className="btn-primary" onClick={handleSaveCustomTheme}>
                Gem tilpasset tema
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card-soft">
        <h3 className="text-lg font-semibold text-ink">Integrationer</h3>
        <p className="mt-2 text-sm text-ink/70">iCal-import konfigureres her.</p>
      </div>

      {selectedMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
          <div className="card max-w-lg w-full">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">{selectedMember.user.name}</h3>
                <p className="mt-2 text-sm text-ink/70">Medlemsoplysninger</p>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedMember(null)}>
                Luk
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-ink/70">
              <div>Email: {selectedMember.user.email ?? "—"}</div>
              <div>Telefon: {selectedMember.user.phone ?? "—"}</div>
              <div>Rolle: {roleLabels[selectedMember.role] ?? selectedMember.role}</div>
            </div>
            {isAdmin ? (
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <label className="label">Rolle</label>
                  <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className="input">
                    <option value="ADMIN">Admin</option>
                    <option value="TRAENER">Træner</option>
                    <option value="SPILLER">Spiller</option>
                    <option value="BOEDEKASSEFORMAND">Bødekasseformand</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={handleUpdateRole}>
                    Opdater rolle
                  </button>
                  <button className="btn-ghost" onClick={confirmDeleteMember}>
                    Slet bruger
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showDeleteConfirm && selectedMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
          <div className="card max-w-md w-full">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Slet bruger</h3>
                <p className="mt-2 text-sm text-ink/70">
                  Er du sikker på, at du vil slette {selectedMember.user.name ?? "brugeren"}?
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                Luk
              </button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                className="btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Fortryd
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  await handleDeleteMember();
                  setShowDeleteConfirm(false);
                }}
              >
                Slet bruger
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
