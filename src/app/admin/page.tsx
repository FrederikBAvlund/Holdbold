"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { inputClass } from "@/components/ui/primitives";

export default function AdminPage() {
  const [teamId, setTeamId] = useState("");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("DBU iCal");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/ical/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, url, name })
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Import fejlede");
      } else {
        setMessage(`Import OK: ${data.created} oprettet, ${data.updated} opdateret.`);
      }
    } catch (error) {
      setMessage("Import fejlede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-3 py-6 sm:px-6 sm:py-12">
      <div className="rounded-[1.375rem] border border-line bg-surface shadow-[var(--shadow-sm)] mx-auto max-w-xl p-5 sm:p-7">
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none text-ink">Admin: iCal import</h1>
        <p className="mt-2 text-ink/70">
          Indsæt DBU iCal URL for at hente kampe. Importen kan køres manuelt efter behov.
        </p>

        <form onSubmit={handleImport} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink/80">Team ID</label>
            <input
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className={inputClass}
              placeholder="team_..."
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink/80">iCal URL</label>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={inputClass}
              placeholder="https://..."
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink/80">Navn</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="DBU iCal"
            />
          </div>
          <Button type="submit" size="lg" block loading={loading}>
            Kør import
          </Button>
        </form>

        {message ? <p className="mt-4 text-sm text-ink/80">{message}</p> : null}
      </div>
    </main>
  );
}
