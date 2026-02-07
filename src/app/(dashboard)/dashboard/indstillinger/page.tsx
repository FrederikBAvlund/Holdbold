"use client";

import { useEffect, useState } from "react";
import { setTheme } from "@/components/ThemeProvider";
import {
  getStoredTeamId,
  getStoredUserId,
  setStoredTeamId,
  setStoredUserId
} from "@/components/appState";

type Member = {
  role: string;
  user: {
    id: string;
    name: string;
    email?: string | null;
  };
};

const presets = [
  { id: "atlantic", label: "Atlantic" },
  { id: "sandstone", label: "Sandstone" },
  { id: "forest", label: "Forest" },
  { id: "midnight", label: "Midnight" },
  { id: "mono", label: "Mono" }
];

export default function IndstillingerPage() {
  const [active, setActive] = useState("atlantic");
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTeamId(getStoredTeamId());
    setUserId(getStoredUserId());
  }, []);

  useEffect(() => {
    async function loadTeam() {
      if (!teamId) return;
      const response = await fetch(`/api/team/${teamId}`);
      if (!response.ok) return;
      const data = await response.json();
      const theme = data.team?.themePreset ?? "atlantic";
      setActive(theme);
      setTheme(theme);
    }

    async function loadMembers() {
      if (!teamId) return;
      const response = await fetch(`/api/team-members?teamId=${teamId}`);
      const data = await response.json();
      setMembers(data.members ?? []);
    }

    loadTeam();
    loadMembers();
  }, [teamId]);

  function handleTheme(theme: string) {
    setActive(theme);
    setTheme(theme);
    if (!teamId) return;
    fetch(`/api/team/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themePreset: theme })
    }).catch(() => undefined);
  }

  function handleSaveContext() {
    setStoredTeamId(teamId);
    setStoredUserId(userId);
    setMessage("Indstillinger gemt");
  }

  return (
    <section className="space-y-6">
      <header className="card">
        <h2 className="text-2xl font-semibold text-ink">Indstillinger</h2>
        <p className="mt-2 text-ink/70">Team, roller og integrationsindstillinger.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Aktiv kontekst</h3>
          <p className="mt-2 text-sm text-ink/70">Vælg aktivt team og bruger til visning og handlinger.</p>
          <div className="mt-4 grid gap-3">
            <input
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              placeholder="Team ID"
              className="input"
            />
            <select value={userId} onChange={(event) => setUserId(event.target.value)} className="input">
              <option value="">Vælg aktiv bruger</option>
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.name} ({member.role})
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={handleSaveContext}>
              Gem kontekst
            </button>
            {message ? <p className="text-sm text-ink/70">{message}</p> : null}
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
        </div>
      </div>

      <div className="card-soft">
        <h3 className="text-lg font-semibold text-ink">Integrationer</h3>
        <p className="mt-2 text-sm text-ink/70">iCal-import konfigureres her.</p>
      </div>
    </section>
  );
}
