"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet, { ConfirmSheet } from "@/components/ui/Sheet";
import { Field, Skeleton, inputClass } from "@/components/ui/primitives";
import FineRow from "@/components/fines/FineRow";
import { formatKr, formatRelativePast } from "@/lib/format";
import { categoryOptions } from "../boderConstants";
import type { FineItem, FineTemplate } from "../boderTypes";
import { canDeleteFine, canSettleFine, parseIntegerAmountInput, summarizeFines } from "../boderUtils";

/* ---------- Betal ---------- */

export function PaySheet({
  open,
  onClose,
  teamId,
  amount,
  mobilePayBox,
  onPaid
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  amount: number;
  mobilePayBox: string;
  onPaid: () => Promise<void> | void;
}) {
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mobilePayBox);
      setCopied(true);
      pushToast("MobilePay-nummer kopieret", "success");
    } catch {
      pushToast("Kunne ikke kopiere", "error");
    }
  }

  async function markPaid() {
    setSaving(true);
    try {
      const response = await fetch("/api/fines/payments/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke markere som betalt", "error");
        return;
      }
      pushToast("Tak! Betalingen venter på godkendelse 🙌", "success");
      await onPaid();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    {
      title: "Kopiér MobilePay-nummeret",
      body: mobilePayBox ? (
        <button
          type="button"
          onClick={copy}
          className="mt-2 flex w-full items-center justify-between gap-3 rounded-2xl bg-ink/[0.05] px-4 py-3 text-left transition active:scale-[0.99]"
        >
          <span className="tabular font-display text-3xl font-bold tracking-wider text-ink">{mobilePayBox}</span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-moss">
            <Icon name={copied ? "check" : "copy"} className="h-4 w-4" />
            {copied ? "Kopieret" : "Kopiér"}
          </span>
        </button>
      ) : (
        <p className="mt-1 text-sm text-out">Holdet har ikke sat et MobilePay-nummer endnu. Spørg bødekasseformanden.</p>
      )
    },
    {
      title: "Overfør beløbet",
      body: <p className="tabular mt-1 font-display text-4xl font-extrabold text-ink">{formatKr(amount)}</p>
    },
    {
      title: "Sig til, når det er gjort",
      body: <p className="mt-1 text-sm text-ink/60">Bødekasseformanden godkender, og så er du gældfri.</p>
    }
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Betal dine bøder"
      dismissible={!saving}
      footer={
        <Button block size="lg" icon="check" loading={saving} disabled={!mobilePayBox || amount <= 0} onClick={markPaid}>
          Jeg har betalt
        </Button>
      }
    >
      <ol className="space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-on-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="font-semibold text-ink">{step.title}</p>
              {step.body}
            </div>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

/* ---------- Skabelon ---------- */

type Category = "SOME" | "FAELLES" | "SPILLER" | "DIVERSE";

export function TemplateSheet({
  open,
  onClose,
  teamId,
  template,
  canManage,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  template: FineTemplate | null;
  canManage: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("20");
  const [category, setCategory] = useState<Category>("SPILLER");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(template?.title ?? "");
    setAmount(String(template?.amount ?? 20));
    setCategory((template?.category as Category) ?? "SPILLER");
    setDescription(template?.description ?? "");
    setConfirmDelete(false);
  }, [open, template]);

  const parsed = parseIntegerAmountInput(amount);
  const valid = title.trim().length > 0 && parsed.ok && parsed.value !== 0;

  async function save() {
    if (!valid || !parsed.ok) return;
    setSaving("save");
    try {
      const response = await fetch(template ? `/api/fine-templates/${template.id}` : "/api/fine-templates", {
        method: template ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(template ? {} : { teamId }),
          title: title.trim(),
          amount: parsed.value,
          category,
          description: description.trim() || (template ? null : undefined)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke gemme", "error");
        return;
      }
      pushToast(template ? "Bøden er opdateret" : canManage ? "Tilføjet til kataloget" : "Forslag sendt", "success");
      await onSaved();
      onClose();
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    if (!template) return;
    setSaving("delete");
    try {
      const response = await fetch(`/api/fine-templates/${template.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke slette", "error");
        return;
      }
      pushToast("Fjernet fra kataloget", "success");
      await onSaved();
      setConfirmDelete(false);
      onClose();
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <Sheet
        open={open && !confirmDelete}
        onClose={onClose}
        dismissible={!saving}
        title={template ? "Rediger bøde" : canManage ? "Ny bøde i kataloget" : "Foreslå ny bøde"}
        description={
          template
            ? undefined
            : canManage
              ? "Kan bruges med det samme."
              : "Bødekasseformanden godkender, før den kommer i kataloget."
        }
        footer={
          <div className="flex gap-2">
            {template ? (
              <Button
                variant="danger"
                size="lg"
                icon="x"
                aria-label="Slet bøde"
                onClick={() => setConfirmDelete(true)}
              />
            ) : null}
            <Button block size="lg" loading={saving === "save"} disabled={!valid} onClick={save}>
              {template ? "Gem ændringer" : canManage ? "Tilføj" : "Send forslag"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Navn" htmlFor="tpl-title">
            <input
              id="tpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fx For sent til træning"
              className={inputClass}
            />
          </Field>
          <Field label="Beløb (kr)" htmlFor="tpl-amount" hint="Minus giver en kredit, fx -10.">
            <input id="tpl-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={inputClass} />
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-ink/80">Kategori</p>
            <div className="grid grid-cols-4 gap-2">
              {categoryOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  aria-pressed={category === option.value}
                  className={cn(
                    "min-h-11 rounded-2xl text-sm font-semibold transition",
                    category === option.value ? "bg-ink text-bg" : "bg-ink/[0.06] text-ink/70"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Beskrivelse (valgfri)" htmlFor="tpl-desc">
            <textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={cn(inputClass, "py-3")}
            />
          </Field>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={saving === "delete"}
        title="Slet bøden?"
        description="Den forsvinder fra kataloget. Bøder, der allerede er givet, bliver stående."
        confirmLabel="Slet"
      />
    </>
  );
}

/* ---------- Indsamling ---------- */

export function CollectionSheet({
  open,
  onClose,
  teamId,
  templates,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  templates: FineTemplate[];
  onSaved: () => Promise<void> | void;
}) {
  const { pushToast } = useToast();
  const [templateId, setTemplateId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const approved = templates.filter((t) => !t.status || t.status === "APPROVED");

  useEffect(() => {
    if (!open) return;
    const next = new Date(Date.now() + 7 * 86_400_000);
    next.setHours(20, 0, 0, 0);
    setDeadline(new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setTemplateId((prev) => prev || approved.find((t) => /for sent|betal/i.test(t.title))?.id || "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!templateId || !deadline) return;
    setSaving(true);
    try {
      const response = await fetch("/api/fines/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, templateId, deadlineAt: new Date(deadline).toISOString() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke starte indsamlingen", "error");
        return;
      }
      pushToast("Indsamlingen er startet", "success");
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Start indsamling"
      description="Alle med ubetalte bøder efter fristen får automatisk den valgte bøde – og igen hvert døgn, indtil de har betalt."
      footer={
        <Button block size="lg" loading={saving} disabled={!templateId || !deadline} onClick={save}>
          Start indsamling
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Betal senest" htmlFor="col-deadline">
          <input id="col-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Bøde ved for sen betaling" htmlFor="col-template">
          <select id="col-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputClass}>
            <option value="">Vælg bøde</option>
            {approved.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({formatKr(t.amount)})
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Sheet>
  );
}

/* ---------- Et medlems bøder ---------- */

export function MemberFinesSheet({
  open,
  onClose,
  member,
  fines,
  canManage,
  onDelete,
  onSettle,
  settlingId
}: {
  open: boolean;
  onClose: () => void;
  member: { name: string | null; image?: string | null } | null;
  fines: FineItem[] | null;
  canManage: boolean;
  onDelete: (fine: FineItem) => void;
  onSettle: (fine: FineItem) => void;
  settlingId: string | null;
}) {
  const totals = summarizeFines(fines ?? []);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={member?.name ?? "Medlem"}
      description={fines ? `${formatKr(totals.owed)} skyldig · ${formatKr(totals.paid)} betalt` : undefined}
    >
      <div className="mb-4 flex justify-center">
        <Avatar name={member?.name} image={member?.image} size="xl" />
      </div>
      {fines === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : fines.length === 0 ? (
        <p className="text-center text-sm text-ink/55">Ingen bøder – ren tavle ✨</p>
      ) : (
        <div className="-mx-5 divide-y divide-line border-y border-line">
          {fines.map((fine) => (
            <FineRow
              key={fine.id}
              title={fine.reason}
              description={fine.description}
              meta={formatRelativePast(fine.createdAt)}
              amount={fine.amount}
              status={fine.status}
              event={fine.event}
              actions={
                canManage && canDeleteFine(fine.status) ? (
                  <>
                    {canSettleFine(fine.status) ? (
                      <Button
                        size="sm"
                        variant="success"
                        icon="check"
                        loading={settlingId === fine.id}
                        disabled={settlingId !== null}
                        onClick={() => onSettle(fine)}
                      >
                        Markér betalt
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" icon="x" disabled={settlingId !== null} onClick={() => onDelete(fine)}>
                      Slet
                    </Button>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
