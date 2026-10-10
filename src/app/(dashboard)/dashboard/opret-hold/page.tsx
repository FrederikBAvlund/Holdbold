"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Chip, Field, ListGroup, ListRow, PageHeader, Section, inputClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME_ID, THEME_PRESETS } from "@/lib/themePresets";
import { slugify } from "@/lib/superAdmin";

type TeamRequest = {
  id: string;
  name: string;
  slug: string;
  themePreset: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<TeamRequest["status"], string> = {
  PENDING: "Afventer godkendelse",
  APPROVED: "Godkendt",
  REJECTED: "Afvist"
};

export default function RequestTeamPage() {
  const { pushToast } = useToast();
  const [requests, setRequests] = useState<TeamRequest[] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [theme, setTheme] = useState<string>(DEFAULT_THEME_ID);
  const [slugState, setSlugState] = useState<{ available: boolean; message: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkId = useRef(0);

  const load = useCallback(async () => {
    const response = await fetch("/api/team-requests", { cache: "no-store" });
    setRequests(response.ok ? ((await response.json()).requests ?? []) : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Holdkoden følger holdnavnet, indtil brugeren selv ændrer den.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Tjek løbende, om holdkoden er ledig (inkl. koder, der er reserveret af andre anmodninger).
  useEffect(() => {
    const normalized = slugify(slug);
    if (normalized.length < 2) {
      setSlugState(null);
      return;
    }
    const id = ++checkId.current;
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/team-requests/slug-check?slug=${encodeURIComponent(normalized)}`, { cache: "no-store" });
      if (!response.ok || id !== checkId.current) return;
      const data = (await response.json()) as { available: boolean; message: string | null };
      setSlugState({ available: data.available, message: data.message });
    }, 300);
    return () => clearTimeout(timer);
  }, [slug]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/team-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, themePreset: theme })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Kunne ikke sende anmodningen");
        return;
      }
      pushToast("Anmodning sendt. Du får en mail, når holdet er godkendt.", "success");
      setName("");
      setSlug("");
      setSlugTouched(false);
      setSlugState(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7 pb-8 pt-1">
      <PageHeader title="Anmod om nyt hold" subtitle="Når anmodningen er godkendt, bliver du administrator for holdet." />

      <Section title="Dit hold">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Holdnavn*">
            <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="BK Skjold" maxLength={60} required />
          </Field>
          <Field label="Holdkode*">
            <input
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              className={inputClass}
              placeholder="bk-skjold"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              required
            />
            {slugState ? (
              <p className={cn("mt-2 text-sm", slugState.available ? "text-moss" : "text-danger")}>
                {slugState.available ? `Holdkoden "${slugify(slug)}" er ledig og bliver reserveret til dig` : slugState.message}
              </p>
            ) : (
              <p className="mt-2 text-xs text-ink/60">Bruges af spillere, når de tilmelder sig holdet.</p>
            )}
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink/80">Farvetema</p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTheme(preset.id)}
                  aria-pressed={theme === preset.id}
                  className={cn(
                    "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-sm font-semibold transition active:scale-95",
                    theme === preset.id ? "border-moss bg-moss/10 text-ink" : "border-line text-ink/70 hover:bg-ink/[0.03]"
                  )}
                >
                  <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-surface" style={{ background: preset.swatch }}>
                    {theme === preset.id ? <Icon name="check" className="h-4 w-4 text-white" strokeWidth={3} /> : null}
                  </span>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
          <Button type="submit" size="lg" block loading={saving} disabled={slugState?.available === false}>
            Send anmodning
          </Button>
        </form>
      </Section>

      {requests && requests.length > 0 ? (
        <Section title="Dine anmodninger">
          <ListGroup>
            {requests.map((request) => (
              <ListRow
                key={request.id}
                title={request.name}
                subtitle={request.status === "REJECTED" && request.rejectionReason ? `${request.slug} · ${request.rejectionReason}` : request.slug}
                trailing={<Chip>{STATUS_LABEL[request.status]}</Chip>}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}
    </div>
  );
}
