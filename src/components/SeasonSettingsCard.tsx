"use client";

import { useState } from "react";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

export default function SeasonSettingsCard({
  teamId,
  isAdmin,
  storageKey
}: {
  teamId: string;
  isAdmin: boolean;
  storageKey: string;
}) {
  const { seasons, activeSeason, selectedSeason, selectSeason, refreshSeasons } = useDashboardTeam();
  const [confirming, setConfirming] = useState(false);
  const [newName, setNewName] = useState("");
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function closeSeason() {
    setClosing(true);
    setError(null);
    try {
      const response = await fetch(`/api/team/${teamId}/seasons/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, ...(newName.trim() ? { name: newName.trim() } : {}) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Kunne ikke lukke sæsonen");
        return;
      }
      selectSeason(data.season.id);
      await refreshSeasons();
      // Genindlæs, så alle sider og caches starter forfra med den nye sæson.
      window.location.reload();
    } finally {
      setClosing(false);
    }
  }

  return (
    <CollapsibleCard
      title="Sæson"
      description="Se holdets historik fra tidligere sæsoner. Lukkede sæsoner er kun til læsning."
      storageKey={storageKey}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="label" htmlFor="season-select">Vis sæson</label>
          <select
            id="season-select"
            className="input"
            value={selectedSeason?.id ?? ""}
            onChange={(event) => selectSeason(event.target.value)}
            disabled={seasons.length === 0}
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name} ({formatDate(season.startedAt)}
                {season.closedAt ? ` – ${formatDate(season.closedAt)}, lukket` : ", aktiv"})
              </option>
            ))}
          </select>
        </div>

        {isAdmin && activeSeason ? (
          <div className="space-y-3 rounded-2xl border border-ink/10 bg-white/80 p-4">
            <p className="text-sm font-semibold text-ink">Luk {activeSeason.name} og start ny sæson</p>
            {!confirming ? (
              <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>
                Nulstil sæson…
              </button>
            ) : (
              <div className="space-y-3">
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
                  <li>Alle begivenheder (også kommende), tilmeldinger og statistik arkiveres.</li>
                  <li>Ubetalte bøder overføres til den nye sæson. Betalte bøder bliver i den gamle.</li>
                  <li>Bødeskabeloner, medlemmer og indstillinger bevares.</li>
                  <li><strong>Den lukkede sæson kan ikke ændres bagefter – kun ses.</strong></li>
                </ul>
                <div className="space-y-2">
                  <label className="label" htmlFor="season-name">Navn på ny sæson (valgfrit)</label>
                  <input
                    id="season-name"
                    className="input"
                    value={newName}
                    maxLength={60}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="fx Sæson 2026/27"
                  />
                </div>
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" onClick={closeSeason} disabled={closing}>
                    {closing ? "Lukker..." : "Ja, luk sæsonen"}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} disabled={closing}>
                    Annullér
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </CollapsibleCard>
  );
}
