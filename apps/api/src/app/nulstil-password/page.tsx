"use client";

import AuthShell from "@/components/AuthShell";
import Button from "@/components/ui/Button";
import { inputClass } from "@/components/ui/primitives";
import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Adgangskoderne er ikke ens.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Noget gik galt. Prøv igen.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Noget gik galt. Prøv igen.");
    }
    setLoading(false);
  }

  return (
    <AuthShell title="Ny adgangskode" subtitle="Vælg en ny adgangskode på mindst 8 tegn.">
      {error ? (
        <p className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">{error}</p>
      ) : null}
      {done ? (
        <>
          <p className="mb-4 rounded-2xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm font-medium text-success">
            Din adgangskode er opdateret.
          </p>
          <Button block size="lg" onClick={() => (window.location.href = "/login")}>
            Log ind
          </Button>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Ny adgangskode"
            aria-label="Ny adgangskode"
            className={inputClass}
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Gentag adgangskode"
            aria-label="Gentag adgangskode"
            className={inputClass}
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <Button type="submit" size="lg" block loading={loading} disabled={!token}>
            Gem adgangskode
          </Button>
          {!token ? <p className="text-sm text-danger">Linket mangler et token. Bed om et nyt.</p> : null}
        </form>
      )}
    </AuthShell>
  );
}
