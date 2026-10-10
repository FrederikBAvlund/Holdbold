"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { ListRow } from "@/components/ui/primitives";
import { useToast } from "@/components/ToastProvider";

type Feed = { httpsUrl: string; webcalUrl: string };

/** Lader brugeren abonnere på sine begivenheder i Kalender (Mac/iPhone) eller Google Kalender. */
export default function CalendarFeedSettings() {
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(method: "GET" | "POST") {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/me/calendar-feed", { method, cache: "no-store" });
      if (!response.ok) throw new Error();
      setFeed((await response.json()) as Feed);
      if (method === "POST") pushToast("Nyt link oprettet – det gamle virker ikke længere", "success");
    } catch {
      setError("Kunne ikke hente kalenderlinket. Prøv igen.");
    } finally {
      setLoading(false);
    }
  }

  function openSheet() {
    setOpen(true);
    if (!feed) void load("GET");
  }

  async function copyLink() {
    if (!feed) return;
    try {
      await navigator.clipboard.writeText(feed.httpsUrl);
      pushToast("Link kopieret", "success");
    } catch {
      pushToast("Kunne ikke kopiere linket", "error");
    }
  }

  function regenerate() {
    if (window.confirm("Det nuværende link holder op med at virke. Vil du oprette et nyt?")) {
      void load("POST");
    }
  }

  return (
    <>
      <ListRow
        onClick={openSheet}
        chevron
        leading={
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
            <Icon name="calendar" />
          </span>
        }
        title="Synkronisér med Kalender"
        subtitle="Abonnér på holdets begivenheder på Mac og iPhone"
      />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Synkronisér med Kalender"
        description="Alle begivenheder fra dine hold dukker op i din egen kalender og opdateres automatisk."
      >
        <div className="space-y-4">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {feed ? (
            <>
              <a
                href={feed.webcalUrl}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-display text-lg font-bold uppercase tracking-wide text-on-primary transition active:scale-[0.98]"
              >
                <Icon name="calendar" />
                Åbn i Kalender
              </a>
              <Button type="button" variant="secondary" block onClick={copyLink}>
                <Icon name="copy" className="h-4 w-4" />
                Kopiér link
              </Button>
              <div className="space-y-1.5 rounded-2xl bg-ink/[0.04] p-3 text-sm text-ink/70">
                <p>
                  <strong className="text-ink">Mac:</strong> Åbn i Kalender og tryk &quot;Abonnér&quot;. Eller vælg Arkiv
                  → Nyt kalenderabonnement og indsæt linket.
                </p>
                <p>
                  <strong className="text-ink">iPhone:</strong> Tryk &quot;Åbn i Kalender&quot; og bekræft.
                </p>
                <p>
                  <strong className="text-ink">Google Kalender:</strong> Tilføj kalender → Fra URL, og indsæt linket.
                </p>
                <p>Kalenderen henter selv ændringer med jævne mellemrum – nogle gange tager det et par timer.</p>
              </div>
              <p className="text-xs text-ink/55">
                Linket er personligt – del det ikke med andre. Er det kommet i forkerte hænder, kan du oprette et nyt.
              </p>
              <Button type="button" variant="ghost" block loading={loading} onClick={regenerate}>
                Opret nyt link
              </Button>
            </>
          ) : loading ? (
            <p className="text-sm text-ink/60">Henter link…</p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
