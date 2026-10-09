"use client";

import AuthShell from "@/components/AuthShell";
import Button from "@/components/ui/Button";
import { inputClass } from "@/components/ui/primitives";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Noget gik galt. Prøv igen.");
      } else {
        setMessage(data.message);
      }
    } catch {
      setError("Noget gik galt. Prøv igen.");
    }
    setLoading(false);
  }

  return (
    <AuthShell title="Glemt adgangskode" subtitle="Indtast din email, så sender vi et link til at vælge en ny.">
      {error ? (
        <p className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">{error}</p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-2xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm font-medium text-success">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            className={inputClass}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value.toLowerCase())}
            required
          />
          <Button type="submit" size="lg" block loading={loading}>
            Send link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-ink/70">
        <a href="/login" className="font-semibold text-moss underline decoration-moss/30 underline-offset-4 hover:decoration-moss">
          Tilbage til log ind
        </a>
      </p>
    </AuthShell>
  );
}
