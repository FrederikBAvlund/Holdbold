"use client";

import { useState } from "react";

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
    <main className="min-h-screen px-6 py-12">
      <div className="card max-w-xl">
        <h1 className="text-2xl font-semibold text-ink">Admin: iCal import</h1>
        <p className="mt-2 text-ink/70">
          Indsæt DBU iCal URL for at hente kampe. Importen kan køres manuelt efter behov.
        </p>

        <form onSubmit={handleImport} className="mt-6 space-y-4">
          <div>
            <label className="label">Team ID</label>
            <input
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="input mt-2"
              placeholder="team_..."
              required
            />
          </div>
          <div>
            <label className="label">iCal URL</label>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="input mt-2"
              placeholder="https://..."
              required
            />
          </div>
          <div>
            <label className="label">Navn</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input mt-2"
              placeholder="DBU iCal"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Importerer..." : "Kør import"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-ink/80">{message}</p> : null}
      </div>
    </main>
  );
}
