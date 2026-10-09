"use client";

import { useState } from "react";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { Card, Field, inputClass } from "@/components/ui/primitives";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

/** Vælg hvilken sæson du ser (alle på holdet). */
export function SeasonViewerCard() {
  const { seasons, selectedSeason, selectSeason } = useDashboardTeam();
  if (seasons.length < 2) return null;
  return (
    <Card className="space-y-3">
      <Field
        label="Vis sæson"
        htmlFor="season-select"
        hint="Tidligere sæsoner kan kun ses, ikke ændres."
      >
        <select
          id="season-select"
          className={inputClass}
          value={selectedSeason?.id ?? ""}
          onChange={(event) => selectSeason(event.target.value)}
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name} ({formatDate(season.startedAt)}
              {season.closedAt ? ` – ${formatDate(season.closedAt)}` : ", aktiv"})
            </option>
          ))}
        </select>
      </Field>
    </Card>
  );
}

/** Admin: luk den aktive sæson og start en ny. */
export function SeasonCloseCard({ teamId }: { teamId: string }) {
  const { activeSeason, selectSeason, refreshSeasons } = useDashboardTeam();
  const [open, setOpen] = useState(false);
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

  if (!activeSeason) return null;

  return (
    <>
      <Card className="space-y-3">
        <p className="text-sm text-ink/60">
          Nu kører <span className="font-semibold text-ink">{activeSeason.name}</span>. Når sæsonen er slut, kan du
          lukke den og starte forfra med en ny.
        </p>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Afslut sæsonen…
        </Button>
      </Card>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!closing}
        title={`Afslut ${activeSeason.name}?`}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={closing}>
              Fortryd
            </Button>
            <Button variant="danger" className="flex-1" onClick={closeSeason} loading={closing}>
              Ja, afslut sæsonen
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/70">
            <li>Alle begivenheder (også kommende), tilmeldinger og statistik arkiveres.</li>
            <li>Ubetalte bøder flyttes med til den nye sæson. Betalte bøder bliver i den gamle.</li>
            <li>Bødeskabeloner, medlemmer og indstillinger bevares.</li>
            <li className="font-semibold text-ink">Den afsluttede sæson kan bagefter kun ses, ikke ændres.</li>
          </ul>
          <Field label="Navn på ny sæson (valgfrit)" htmlFor="season-name" error={error}>
            <input
              id="season-name"
              className={inputClass}
              value={newName}
              maxLength={60}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="fx Sæson 2026/27"
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
