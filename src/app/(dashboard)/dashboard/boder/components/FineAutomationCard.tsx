"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import Button from "@/components/ui/Button";
import { Skeleton, inputClass } from "@/components/ui/primitives";
import {
  fetchFineAutomationCached,
  primeFineAutomationCache,
  type FineAutomationPayload
} from "@/lib/fineAutomationClientCache";
import { formatKr } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roleLabels";

// Samme regler som tidligere lå i Indstillinger; teksterne er skrevet om til hverdagssprog.
const ACTIONS = [
  {
    action: "MISSED_SIGNUP_AT_DEADLINE",
    label: "Svarede ikke til tiden",
    hint: "Når en spiller ikke har svaret, når svarfristen udløber.",
    training: true,
    match: true,
    roles: true
  },
  {
    action: "STATUS_CHANGE_AFTER_DEADLINE",
    label: "Sent afbud",
    hint: "Når nogen melder fra efter svarfristen, men før dagen.",
    training: true,
    match: true,
    roles: true
  },
  {
    action: "SAME_DAY_WITHDRAWAL",
    label: "Afbud samme dag",
    hint: "Når nogen melder fra på selve dagen.",
    training: true,
    match: true,
    roles: true
  },
  {
    action: "MATCH_MOTM_WINNER",
    label: "Kampens spiller",
    hint: "Vinderen af afstemningen giver en omgang – automatisk forslag.",
    training: false,
    match: true,
    roles: false
  },
  {
    action: "MATCH_MOTM_SELF_VOTE",
    label: "Stemte på sig selv",
    hint: "Én bøde pr. stemme, man giver sig selv i Kampens spiller.",
    training: false,
    match: true,
    roles: true
  }
] as const;

const ROLE_KEYS = ["ADMIN", "TRAENER", "SPILLER", "SOME", "BOEDEKASSEFORMAND"] as const;

type Draft = {
  appliesTraining: boolean;
  appliesMatch: boolean;
  templateTrainingId: string;
  templateMatchId: string;
  excludedRoles: string[];
};

const emptyDraft = (): Draft => ({
  appliesTraining: false,
  appliesMatch: false,
  templateTrainingId: "",
  templateMatchId: "",
  excludedRoles: ["SOME"]
});

function draftsFrom(data: FineAutomationPayload) {
  const result: Record<string, Draft> = {};
  for (const def of ACTIONS) {
    const saved = (data.rules ?? []).find((rule) => rule.action === def.action);
    result[def.action] = saved
      ? {
          appliesTraining: Boolean(saved.appliesTraining),
          appliesMatch: Boolean(saved.appliesMatch),
          templateTrainingId: saved.templateTrainingId ?? "",
          templateMatchId: saved.templateMatchId ?? "",
          excludedRoles: Array.isArray(saved.excludedRoles) ? saved.excludedRoles : ["SOME"]
        }
      : emptyDraft();
  }
  return result;
}

export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
        checked ? "bg-primary" : "bg-ink/15"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export default function FineAutomationCard({ teamId }: { teamId: string }) {
  const { pushToast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, Draft> | null>(null);
  const [templates, setTemplates] = useState<NonNullable<FineAutomationPayload["templates"]>>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    let alive = true;
    fetchFineAutomationCached(teamId).then((result) => {
      if (!alive) return;
      if (!result.ok) {
        setDrafts({});
        return;
      }
      setTemplates(result.data.templates ?? []);
      setDrafts(draftsFrom(result.data));
    });
    return () => {
      alive = false;
    };
  }, [teamId]);

  function update(action: string, patch: Partial<Draft>) {
    setDrafts((prev) => (prev ? { ...prev, [action]: { ...(prev[action] ?? emptyDraft()), ...patch } } : prev));
    setDirty(true);
  }

  async function save() {
    if (!drafts) return;
    for (const def of ACTIONS) {
      const draft = drafts[def.action] ?? emptyDraft();
      if (def.training && draft.appliesTraining && !draft.templateTrainingId) {
        pushToast(`Vælg bøde for træning: ${def.label}`, "error");
        return;
      }
      if (def.match && draft.appliesMatch && !draft.templateMatchId) {
        pushToast(`Vælg bøde for kamp: ${def.label}`, "error");
        return;
      }
    }
    const rules = ACTIONS.map((def) => {
      const draft = drafts[def.action] ?? emptyDraft();
      return {
        action: def.action,
        appliesTraining: def.training ? draft.appliesTraining : false,
        appliesMatch: def.match ? draft.appliesMatch : false,
        templateTrainingId: def.training && draft.appliesTraining ? draft.templateTrainingId : null,
        templateMatchId: def.match && draft.appliesMatch ? draft.templateMatchId : null,
        excludedRoles: def.roles ? draft.excludedRoles : []
      };
    });
    setSaving(true);
    try {
      const response = await fetch(`/api/team/${teamId}/fine-automation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke gemme", "error");
        return;
      }
      primeFineAutomationCache(teamId, data);
      setDrafts(draftsFrom(data));
      setDirty(false);
      pushToast("Automatiske bøder gemt", "success");
    } finally {
      setSaving(false);
    }
  }

  if (drafts === null) return <Skeleton className="h-64 rounded-[1.375rem]" />;
  if (templates.length === 0) {
    return (
      <p className="rounded-[1.375rem] border border-dashed border-ink/15 px-4 py-5 text-sm text-ink/60">
        Tilføj mindst én bøde til kataloget, før du kan slå automatiske bøder til.
      </p>
    );
  }

  const templateSelect = (value: string, onChange: (value: string) => void, label: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "min-h-11 text-[0.9375rem]")} aria-label={label}>
      <option value="">Vælg bøde</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.title} ({formatKr(t.amount)})
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-3">
      <div className="divide-y divide-line overflow-hidden rounded-[1.375rem] border border-line bg-surface">
        {ACTIONS.map((def) => {
          const draft = drafts[def.action] ?? emptyDraft();
          const enabled = draft.appliesTraining || draft.appliesMatch;
          return (
            <div key={def.action} className="space-y-3 px-4 py-4">
              <div>
                <p className="font-semibold text-ink">{def.label}</p>
                <p className="text-sm text-ink/55">{def.hint}</p>
              </div>
              {def.training ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink/75">Træning</span>
                    <Switch
                      checked={draft.appliesTraining}
                      onChange={(next) => update(def.action, { appliesTraining: next })}
                      label={`${def.label} ved træning`}
                    />
                  </div>
                  {draft.appliesTraining
                    ? templateSelect(draft.templateTrainingId, (v) => update(def.action, { templateTrainingId: v }), "Bøde ved træning")
                    : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-ink/75">Kamp</span>
                  <Switch
                    checked={draft.appliesMatch}
                    onChange={(next) => update(def.action, { appliesMatch: next })}
                    label={`${def.label} ved kamp`}
                  />
                </div>
                {draft.appliesMatch
                  ? templateSelect(draft.templateMatchId, (v) => update(def.action, { templateMatchId: v }), "Bøde ved kamp")
                  : null}
              </div>
              {def.roles && enabled ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Gælder ikke for</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLE_KEYS.map((role) => {
                      const excluded = draft.excludedRoles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          aria-pressed={excluded}
                          onClick={() =>
                            update(def.action, {
                              excludedRoles: excluded
                                ? draft.excludedRoles.filter((r) => r !== role)
                                : [...draft.excludedRoles, role]
                            })
                          }
                          className={cn(
                            "min-h-9 rounded-full px-3 text-sm font-semibold transition",
                            excluded ? "bg-ink text-bg" : "bg-ink/[0.06] text-ink/65"
                          )}
                        >
                          {ROLE_LABELS[role]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {dirty ? (
        <Button block size="lg" loading={saving} onClick={save}>
          Gem automatiske bøder
        </Button>
      ) : null}
    </div>
  );
}
