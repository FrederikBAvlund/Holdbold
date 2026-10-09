"use client";

import { useEffect, useState } from "react";

/** Landingsside efter Facebook-login fra /signup: opretter afventende medlemskab og sender videre. */
export default function JoinPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("slug")?.trim() ?? "";
    if (!slug) {
      window.location.replace("/dashboard");
      return;
    }
    fetch("/api/auth/join-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamSlug: slug })
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Kunne ikke tilmelde dig holdet");
          return;
        }
        window.location.replace("/dashboard");
      })
      .catch(() => setError("Kunne ikke tilmelde dig holdet"));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      {error ? (
        <div className="text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <a href="/signup" className="mt-3 inline-block text-sm underline underline-offset-4">
            Tilbage til oprettelse
          </a>
        </div>
      ) : (
        <p className="text-sm text-ink/70">Tilmelder dig holdet...</p>
      )}
    </main>
  );
}
