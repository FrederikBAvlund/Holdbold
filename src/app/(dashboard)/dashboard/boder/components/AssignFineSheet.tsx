"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import type { DashboardTeamMember } from "@/components/DashboardTeamProvider";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { Field, inputClass } from "@/components/ui/primitives";
import { rolesLabel } from "@/lib/roleLabels";
import { formatKr } from "@/lib/format";
import { categoryLabel } from "../boderConstants";
import type { FineTemplate } from "../boderTypes";
import { parseIntegerAmountInput } from "../boderUtils";
import { createFinesFor } from "../hooks/useFineActions";

type Step = "what" | "who" | "confirm";

export default function AssignFineSheet({
  open,
  onClose,
  teamId,
  templates,
  members,
  canManage,
  initialTemplateId,
  initialUserIds,
  voiceEnabled = false,
  onVoice,
  onDone
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  templates: FineTemplate[];
  members: DashboardTeamMember[];
  canManage: boolean;
  initialTemplateId?: string;
  initialUserIds?: string[];
  /** Vis "Indtal" som tredje valg (kræver holdets OpenAI-nøgle). */
  voiceEnabled?: boolean;
  onVoice?: () => void;
  onDone: () => Promise<void> | void;
}) {
  const { pushToast } = useToast();
  const [step, setStep] = useState<Step>("what");
  const [templateId, setTemplateId] = useState<string>("");
  const [custom, setCustom] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("50");
  const [description, setDescription] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const approved = useMemo(
    () => templates.filter((t) => !t.status || t.status === "APPROVED").sort((a, b) => a.title.localeCompare(b.title, "da")),
    [templates]
  );
  const activeMembers = useMemo(
    () =>
      members
        .filter((m) => m.status === "ACTIVE")
        .sort((a, b) => (a.user.name ?? "").localeCompare(b.user.name ?? "", "da")),
    [members]
  );

  useEffect(() => {
    if (!open) return;
    setTemplateId(initialTemplateId ?? "");
    setCustom(false);
    setTitle("");
    setAmount("50");
    setDescription("");
    setTemplateQuery("");
    setMemberQuery("");
    setSelected(initialUserIds ?? []);
    setStep(initialTemplateId ? "who" : "what");
  }, [open, initialTemplateId, initialUserIds]);

  const template = approved.find((t) => t.id === templateId);
  const parsedAmount = parseIntegerAmountInput(amount);
  const customValid = title.trim().length > 0 && parsedAmount.ok && parsedAmount.value !== 0;
  const whatValid = custom ? customValid : Boolean(template);
  const fineTitle = custom ? title.trim() : template?.title ?? "";
  const fineAmount = custom ? (parsedAmount.ok ? parsedAmount.value : 0) : template?.amount ?? 0;

  const filteredTemplates = approved.filter((t) =>
    `${t.title} ${t.description ?? ""}`.toLowerCase().includes(templateQuery.trim().toLowerCase())
  );
  const filteredMembers = activeMembers.filter((m) =>
    (m.user.name ?? "").toLowerCase().includes(memberQuery.trim().toLowerCase())
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (!whatValid || selected.length === 0) return;
    setSaving(true);
    try {
      const payload = custom
        ? { teamId, title: fineTitle, amount: fineAmount, description: description.trim() || undefined }
        : { teamId, templateId };
      const result = await createFinesFor(selected, payload);
      const verb = canManage ? "givet" : "foreslået";
      if (result.failed.length === 0) {
        pushToast(`Bøde ${verb} til ${result.ok} spiller${result.ok === 1 ? "" : "e"}`, "success");
        await onDone();
        onClose();
      } else {
        pushToast(
          result.ok > 0
            ? `Bøde ${verb} til ${result.ok} af ${selected.length}. ${result.firstError ?? ""}`.trim()
            : result.firstError ?? "Kunne ikke oprette bøden",
          "error"
        );
        setSelected(result.failed);
        await onDone();
      }
    } finally {
      setSaving(false);
    }
  }

  const titleByStep: Record<Step, string> = {
    what: canManage ? "Giv en bøde" : "Foreslå en bøde",
    who: "Hvem?",
    confirm: "Klar?"
  };

  const footer =
    step === "what" ? (
      <Button block size="lg" disabled={!whatValid} onClick={() => setStep("who")} iconRight="arrow-right">
        Vælg spillere
      </Button>
    ) : step === "who" ? (
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={() => setStep("what")} icon="chevron-left" aria-label="Tilbage" />
        <Button block size="lg" disabled={selected.length === 0} onClick={() => setStep("confirm")}>
          {selected.length === 0 ? "Vælg mindst én" : `Fortsæt med ${selected.length}`}
        </Button>
      </div>
    ) : (
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={() => setStep("who")} icon="chevron-left" aria-label="Tilbage" />
        <Button block size="lg" loading={saving} onClick={submit} icon="check">
          {canManage ? "Giv" : "Foreslå"} {selected.length} bøde{selected.length === 1 ? "" : "r"}
        </Button>
      </div>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={titleByStep[step]}
      description={
        step === "what"
          ? canManage
            ? "Vælg fra kataloget eller lav en ny."
            : "Dit forslag skal godkendes af bødekasseformanden."
          : step === "who"
            ? `${fineTitle} · ${formatKr(fineAmount)}`
            : undefined
      }
      footer={footer}
    >
      <StepDots step={step} />

      {step === "what" ? (
        <div className="space-y-3">
          <div className={cn("grid gap-2", voiceEnabled && onVoice ? "grid-cols-3" : "grid-cols-2")}>
            <button
              type="button"
              onClick={() => setCustom(false)}
              aria-pressed={!custom}
              className={cn(
                "min-h-11 rounded-2xl text-sm font-semibold transition",
                !custom ? "bg-ink text-bg" : "bg-ink/[0.06] text-ink/70"
              )}
            >
              Fra kataloget
            </button>
            <button
              type="button"
              onClick={() => setCustom(true)}
              aria-pressed={custom}
              className={cn(
                "min-h-11 rounded-2xl text-sm font-semibold transition",
                custom ? "bg-ink text-bg" : "bg-ink/[0.06] text-ink/70"
              )}
            >
              Egen bøde
            </button>
            {voiceEnabled && onVoice ? (
              <button
                type="button"
                onClick={onVoice}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-ink/[0.06] text-sm font-semibold text-ink/70 transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
                </svg>
                Indtal
              </button>
            ) : null}
          </div>

          {custom ? (
            <div className="space-y-3">
              <Field label="Hvad er bøden for?" htmlFor="fine-title">
                <input
                  id="fine-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Fx Glemte overtrækstrøjen"
                  className={inputClass}
                />
              </Field>
              <Field label="Beløb (kr)" htmlFor="fine-amount" hint="Brug minus for at give en kredit, fx -20.">
                <input
                  id="fine-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
              <Field label="Note (valgfri)" htmlFor="fine-desc">
                <input
                  id="fine-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          ) : (
            <>
              <SearchInput value={templateQuery} onChange={setTemplateQuery} placeholder="Søg i kataloget" />
              {approved.length === 0 ? (
                <p className="text-sm text-ink/55">Kataloget er tomt. Lav en egen bøde i stedet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {filteredTemplates.map((t) => {
                    const active = t.id === templateId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setTemplateId(t.id)}
                          aria-pressed={active}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]",
                            active ? "border-moss bg-moss/10" : "border-line hover:bg-ink/[0.03]"
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold leading-snug text-ink">{t.title}</span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                              {categoryLabel[t.category] ?? t.category}
                            </span>
                          </span>
                          <span className="tabular shrink-0 font-display text-xl font-bold text-ink">
                            {formatKr(t.amount)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      ) : step === "who" ? (
        <div className="space-y-3">
          <SearchInput value={memberQuery} onChange={setMemberQuery} placeholder="Søg spiller" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-ink/60">{selected.length} valgt</span>
            <span className="flex gap-3">
              <button
                type="button"
                className="font-semibold text-moss"
                onClick={() => setSelected((prev) => Array.from(new Set([...prev, ...filteredMembers.map((m) => m.user.id)])))}
              >
                Vælg {memberQuery ? "viste" : "alle"}
              </button>
              {selected.length > 0 ? (
                <button type="button" className="font-semibold text-ink/55" onClick={() => setSelected([])}>
                  Ryd
                </button>
              ) : null}
            </span>
          </div>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {filteredMembers.map((member) => {
              const checked = selected.includes(member.user.id);
              return (
                <li key={member.user.id}>
                  <button
                    type="button"
                    onClick={() => toggle(member.user.id)}
                    aria-pressed={checked}
                    className="flex min-h-[3.25rem] w-full items-center gap-3 px-3 text-left transition hover:bg-ink/[0.03]"
                  >
                    <Avatar name={member.user.name} image={member.user.image} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{member.user.name}</span>
                      <span className="block text-xs text-ink/50">{rolesLabel(member.roles)}</span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-lg border-2 transition",
                        checked ? "border-primary bg-primary text-on-primary" : "border-ink/20"
                      )}
                    >
                      {checked ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-ink/[0.04] p-4">
            <p className="text-sm font-semibold text-ink/60">{canManage ? "Bøde" : "Forslag"}</p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <p className="font-display text-2xl font-bold uppercase leading-tight text-ink">{fineTitle}</p>
              <p className="tabular shrink-0 font-display text-2xl font-bold text-ink">{formatKr(fineAmount)}</p>
            </div>
            {selected.length > 1 ? (
              <p className="mt-2 text-sm text-ink/60">
                I alt {formatKr(fineAmount * selected.length)} for {selected.length} spillere
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map((id) => {
              const member = activeMembers.find((m) => m.user.id === id);
              return (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] py-1 pl-1 pr-3 text-sm font-semibold text-ink">
                  <Avatar name={member?.user.name} image={member?.user.image} size="xs" />
                  {member?.user.name ?? "Ukendt"}
                </span>
              );
            })}
          </div>
          {!canManage ? (
            <p className="flex items-start gap-2 text-sm text-ink/60">
              <Icon name="clock" className="mt-0.5 h-4 w-4" />
              Bødekasseformanden får besked og godkender eller afviser.
            </p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["what", "who", "confirm"];
  const index = order.indexOf(step);
  return (
    <div className="mb-4 flex gap-1.5" aria-hidden>
      {order.map((s, i) => (
        <span key={s} className={cn("h-1.5 flex-1 rounded-full transition", i <= index ? "bg-primary" : "bg-ink/10")} />
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "pl-11")}
      />
    </div>
  );
}
