"use client";

import { useState } from "react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || undefined, phone: phone || undefined, password, teamId })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Kunne ikke oprette bruger");
      } else {
        setMessage("Bruger oprettet. Du kan nu logge ind.");
      }
    } catch (error) {
      setMessage("Kunne ikke oprette bruger");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="card max-w-xl">
        <h1 className="text-2xl font-semibold text-ink">Opret bruger</h1>
        <p className="mt-2 text-ink/70">Udfyld navn, email eller telefon samt adgangskode.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Navn</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input mt-2"
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input mt-2"
              placeholder="navn@klub.dk"
            />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="input mt-2"
              placeholder="+45..."
            />
          </div>
          <div>
            <label className="label">Adgangskode</label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="input mt-2"
              required
            />
          </div>
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
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Opretter..." : "Opret bruger"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-ink/80">{message}</p> : null}
      </div>
    </main>
  );
}
