"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import Button from "@/components/ui/Button";
import { Card, Chip, Field, inputClass } from "@/components/ui/primitives";

/** Holdets OpenAI-nøgle til indtalte bøder (samme API som før, nyt udseende). */
export default function TeamOpenAiCard({ teamId }: { teamId: string }) {
  const { pushToast } = useToast();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const url = `/api/team/${encodeURIComponent(teamId)}/openai`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!cancelled) setConfigured(Boolean(data.configured));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function save(remove: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: remove ? "DELETE" : "PUT",
        ...(remove
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey }) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme nøglen", "error");
        return;
      }
      setConfigured(Boolean(data.configured));
      setLoadError(false);
      pushToast(remove ? "Nøglen er fjernet" : "Nøglen er gemt", "success");
    } catch {
      pushToast("Kunne ikke gemme nøglen", "error");
    } finally {
      setApiKey("");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink/60">Bruges til at forstå indtalte bøder. Forbruget betales via holdets egen OpenAI-konto.</p>
        {loadError ? (
          <Chip tone="out">Fejl</Chip>
        ) : configured === null ? null : configured ? (
          <Chip tone="in" icon="check">Gemt</Chip>
        ) : (
          <Chip tone="pending">Mangler</Chip>
        )}
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <Field
          label={configured ? "Ny nøgle" : "API-nøgle"}
          htmlFor="team-openai-key"
          hint="Nøglen vises aldrig igen, når den er gemt."
        >
          <input
            id="team-openai-key"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="none"
            maxLength={512}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-…"
            disabled={busy}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy} disabled={!apiKey.trim()}>
            {configured ? "Udskift nøgle" : "Gem nøgle"}
          </Button>
          {configured ? (
            <Button type="button" variant="danger" disabled={busy} onClick={() => void save(true)}>
              Fjern nøgle
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
