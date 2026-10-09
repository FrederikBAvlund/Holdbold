"use client";

import { useEffect, useState } from "react";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { useToast } from "@/components/ToastProvider";

export default function TeamOpenAiSettings({ teamId }: { teamId: string }) {
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
    return () => { cancelled = true; };
  }, [url]);

  async function save(remove: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: remove ? "DELETE" : "PUT",
        ...(remove ? {} : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey })
        })
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme API-nøglen", "error");
        return;
      }
      setConfigured(Boolean(data.configured));
      setLoadError(false);
      pushToast(remove ? "API-nøglen er fjernet" : "API-nøglen er gemt", "success");
    } catch {
      pushToast("Kunne ikke gemme API-nøglen", "error");
    } finally {
      setApiKey("");
      setBusy(false);
    }
  }

  return (
    <CollapsibleCard title="OpenAI" description="Holdets API-nøgle til transskription og fortolkning af talte bøder."
      storageKey={`holdbold:settings:openai:${teamId}`}>
      <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
        <p className="text-sm text-ink/70" role="status">
          {loadError ? "Kunne ikke hente nøglestatus." : configured === null ? "Henter status..." :
            configured ? "En API-nøgle er gemt for holdet." : "Holdet har endnu ingen API-nøgle."}
        </p>
        <p className="text-sm text-ink/70">Forbrug betales via holdets OpenAI-konto. Den gemte nøgle kan udskiftes eller fjernes, men vises aldrig igen.</p>
        <label className="label" htmlFor="team-openai-key">{configured ? "Ny API-nøgle" : "API-nøgle"}</label>
        <input id="team-openai-key" className="input" type="password" autoComplete="new-password"
          spellCheck={false} autoCapitalize="none" value={apiKey} maxLength={512}
          onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." disabled={busy} />
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary" disabled={busy || !apiKey.trim()}>
            {busy ? "Gemmer..." : configured ? "Udskift API-nøgle" : "Gem API-nøgle"}
          </button>
          {configured ? <button type="button" className="btn-ghost" disabled={busy} onClick={() => void save(true)}>Fjern API-nøgle</button> : null}
        </div>
      </form>
    </CollapsibleCard>
  );
}
