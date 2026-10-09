"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { DashboardTeamMember } from "@/components/DashboardTeamProvider";
import { useToast } from "@/components/ToastProvider";
import Button from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { EmptyState, ListGroup, Section } from "@/components/ui/primitives";
import FineRow from "@/components/fines/FineRow";
import { formatKr, formatRelativePast } from "@/lib/format";
import { categoryLabel } from "../boderConstants";
import type { FineItem } from "../boderTypes";
import { groupByReason, inboxDecisionUrl, runPool, type InboxKind } from "../boderUtils";
import type { useFineData } from "../hooks/useFineData";

type Item = {
  key: string;
  kind: InboxKind;
  id: string;
  amount: number;
};

const KIND_LABEL: Record<InboxKind, { one: string; many: string }> = {
  payment: { one: "betaling", many: "betalinger" },
  fine: { one: "bødeforslag", many: "bødeforslag" },
  template: { one: "katalogforslag", many: "katalogforslag" }
};

const keyOf = (kind: InboxKind, id: string) => `${kind}:${id}`;

function creatorName(fine: FineItem) {
  return fine.createdBy?.name ?? fine.createdByLabel ?? null;
}

/**
 * Indbakke for bødekassen. Hver række kan godkendes enkeltvis, men man kan også
 * vælge flere (eller alle med samme tekst) og behandle dem i ét hug.
 */
export default function FineInbox({
  teamId,
  data,
  memberById,
  readOnly
}: {
  teamId: string;
  data: ReturnType<typeof useFineData>;
  memberById: Map<string, DashboardTeamMember>;
  readOnly: boolean;
}) {
  const { pushToast } = useToast();
  const pendingTemplates = useMemo(() => data.templates.filter((t) => t.status === "PENDING"), [data.templates]);

  const items = useMemo<Item[]>(
    () => [
      ...data.pendingPayments.map((p) => ({ key: keyOf("payment", p.userId), kind: "payment" as const, id: p.userId, amount: p.total })),
      ...data.proposed.map((f) => ({ key: keyOf("fine", f.id), kind: "fine" as const, id: f.id, amount: f.amount })),
      ...pendingTemplates.map((t) => ({ key: keyOf("template", t.id), kind: "template" as const, id: t.id, amount: t.amount }))
    ],
    [data.pendingPayments, data.proposed, pendingTemplates]
  );
  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ approve: boolean; targets: Item[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [singleBusy, setSingleBusy] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Fjern valg for rækker, der er væk efter en opdatering.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(Array.from(prev).filter((key) => itemByKey.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [itemByKey]);

  useEffect(() => {
    if (items.length === 0) setSelecting(false);
  }, [items.length]);

  const reasonGroups = useMemo(() => groupByReason(data.proposed), [data.proposed]);

  const selectedItems = useMemo(
    () => Array.from(selected).map((key) => itemByKey.get(key)).filter((item): item is Item => Boolean(item)),
    [selected, itemByKey]
  );
  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.amount, 0);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleMany(keys: string[]) {
    setSelected((prev) => {
      const allOn = keys.every((key) => prev.has(key));
      const next = new Set(prev);
      for (const key of keys) {
        if (allOn) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function decideOne(kind: InboxKind, id: string, approve: boolean) {
    if (singleBusy || busy) return;
    const key = `${keyOf(kind, id)}:${approve ? "a" : "r"}`;
    setSingleBusy(key);
    try {
      const response = await fetch(inboxDecisionUrl(kind, id, approve), {
        method: "POST",
        headers: kind === "payment" ? { "Content-Type": "application/json" } : undefined,
        // Betalings-endpoints kræver holdet i body.
        body: kind === "payment" ? JSON.stringify({ teamId }) : undefined
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof body.error === "string" ? body.error : "Kunne ikke gemme", "error");
        return;
      }
      const labels = {
        payment: approve ? "Betaling godkendt" : "Betaling afvist",
        fine: approve ? "Bøde godkendt" : "Bøde afvist",
        template: approve ? "Tilføjet til kataloget" : "Forslag afvist"
      };
      pushToast(labels[kind], "success");
      await data.refresh();
    } finally {
      setSingleBusy(null);
    }
  }

  async function decideMany() {
    if (!confirm || busy) return;
    const { approve, targets } = confirm;
    setBusy(true);
    setProgress({ done: 0, total: targets.length });
    try {
      const result = await runPool(
        targets,
        async (item) => {
          const response = await fetch(inboxDecisionUrl(item.kind, item.id, approve), {
            method: "POST",
            headers: item.kind === "payment" ? { "Content-Type": "application/json" } : undefined,
            body: item.kind === "payment" ? JSON.stringify({ teamId }) : undefined
          });
          return response.ok;
        },
        { concurrency: 4, onProgress: (done, total) => setProgress({ done, total }) }
      );
      const verb = approve ? "godkendt" : "afvist";
      if (result.failed.length === 0) {
        pushToast(`${result.ok} ${verb}`, "success");
        stopSelecting();
      } else if (result.ok === 0) {
        pushToast("Ingen kunne gemmes. Prøv igen om lidt.", "error");
      } else {
        pushToast(`${result.ok} af ${targets.length} ${verb}. ${result.failed.length} fejlede – de er stadig valgt.`, "error");
        setSelected(new Set(result.failed.map((item) => item.key)));
      }
      setConfirm(null);
      await data.refresh();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function askBulk(approve: boolean, targets: Item[]) {
    if (targets.length === 0) return;
    setConfirm({ approve, targets });
  }

  const decisionButtons = (kind: InboxKind, id: string) =>
    readOnly || selecting ? null : (
      <>
        <Button size="sm" variant="success" icon="check" loading={singleBusy === `${keyOf(kind, id)}:a`} disabled={busy} onClick={() => decideOne(kind, id, true)}>
          Godkend
        </Button>
        <Button size="sm" variant="secondary" loading={singleBusy === `${keyOf(kind, id)}:r`} disabled={busy} onClick={() => decideOne(kind, id, false)}>
          Afvis
        </Button>
      </>
    );

  const selectFor = (kind: InboxKind, id: string) =>
    selecting ? { checked: selected.has(keyOf(kind, id)), onToggle: () => toggle(keyOf(kind, id)) } : undefined;

  function groupHeader(title: string, kind: InboxKind, keys: string[]) {
    const allOn = keys.length > 0 && keys.every((key) => selected.has(key));
    return (
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink/50">
          {title}
          <span className="tabular rounded-full bg-pending px-1.5 text-[0.6875rem] text-on-solid">{keys.length}</span>
        </p>
        {readOnly || keys.length < 2 ? null : selecting ? (
          <button type="button" onClick={() => toggleMany(keys)} className="min-h-8 px-1 text-sm font-semibold text-moss">
            {allOn ? "Fravælg alle" : "Vælg alle"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => askBulk(true, keys.map((key) => itemByKey.get(key)!).filter(Boolean))}
            className="season-lock min-h-8 px-1 text-sm font-semibold text-moss"
          >
            Godkend alle
          </button>
        )}
      </div>
    );
  }

  const paymentKeys = data.pendingPayments.map((p) => keyOf("payment", p.userId));
  const fineKeys = data.proposed.map((f) => keyOf("fine", f.id));
  const templateKeys = pendingTemplates.map((t) => keyOf("template", t.id));

  const actionBar =
    selecting && selected.size > 0 && !readOnly ? (
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-[55] flex justify-center px-4 lg:bottom-6 lg:pl-[17rem]">
        <div className="pointer-events-auto flex w-full max-w-md animate-pop-in items-center gap-2 rounded-[1.5rem] border border-line bg-surface p-2 pl-4 shadow-[var(--shadow-lg)]">
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-display text-lg font-bold uppercase">{selected.size} valgt</p>
            <p className="tabular text-xs text-ink/55">{formatKr(selectedTotal)}</p>
          </div>
          <Button variant="secondary" size="md" onClick={() => askBulk(false, selectedItems)}>
            Afvis
          </Button>
          <Button variant="success" size="md" icon="check" onClick={() => askBulk(true, selectedItems)}>
            Godkend
          </Button>
        </div>
      </div>
    ) : null;

  const confirmTargets = confirm?.targets ?? [];
  const confirmKinds = Array.from(new Set(confirmTargets.map((t) => t.kind)));
  const confirmTotal = confirmTargets.reduce((sum, item) => sum + item.amount, 0);
  const noun =
    confirmKinds.length === 1
      ? confirmTargets.length === 1
        ? KIND_LABEL[confirmKinds[0]].one
        : KIND_LABEL[confirmKinds[0]].many
      : "forslag";

  return (
    <Section
      title="Indbakke"
      action={
        !readOnly && items.length > 1 ? (
          <button
            type="button"
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            className="min-h-8 px-1 text-sm font-semibold text-moss"
          >
            {selecting ? "Færdig" : "Vælg flere"}
          </button>
        ) : null
      }
    >
      {items.length === 0 ? (
        <EmptyState icon="check" title="Alt er godkendt" description="Der er ingen forslag eller betalinger, der venter." />
      ) : (
        <div className="space-y-4">
          {!readOnly && reasonGroups.length > 0 ? (
            <div className="space-y-1.5">
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-ink/50">Hurtigvalg</p>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5">
                {reasonGroups.map((group) => {
                  const keys = group.items.map((fine) => keyOf("fine", fine.id));
                  const allOn = selecting && keys.every((key) => selected.has(key));
                  return (
                    <button
                      key={group.reason}
                      type="button"
                      aria-pressed={allOn}
                      onClick={() => {
                        setSelecting(true);
                        toggleMany(keys);
                      }}
                      className={cn(
                        "inline-flex min-h-10 max-w-[16rem] shrink-0 items-center gap-2 rounded-2xl border px-3.5 text-[0.9375rem] font-semibold transition active:scale-95",
                        allOn ? "border-transparent bg-primary/12 text-moss ring-1 ring-moss/30" : "border-line bg-surface text-ink/75"
                      )}
                    >
                      <span className="truncate">{group.reason}</span>
                      <span className="tabular rounded-full bg-ink/[0.08] px-1.5 text-xs">{group.items.length}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {data.pendingPayments.length > 0 ? (
            <div className="space-y-1.5">
              {groupHeader("Betalinger", "payment", paymentKeys)}
              <ListGroup>
                {data.pendingPayments.map((payment) => {
                  const member = memberById.get(payment.userId);
                  return (
                    <FineRow
                      key={payment.userId}
                      title={`${payment.count} bøde${payment.count === 1 ? "" : "r"} markeret betalt`}
                      person={{ name: member?.user.name ?? payment.name, image: member?.user.image }}
                      meta={payment.requestedAt ? formatRelativePast(payment.requestedAt) : undefined}
                      amount={payment.total}
                      select={selectFor("payment", payment.userId)}
                      actions={decisionButtons("payment", payment.userId)}
                    />
                  );
                })}
              </ListGroup>
            </div>
          ) : null}

          {data.proposed.length > 0 ? (
            <div className="space-y-1.5">
              {groupHeader("Bødeforslag", "fine", fineKeys)}
              <ListGroup>
                {data.proposed.map((fine) => (
                  <FineRow
                    key={fine.id}
                    title={fine.reason}
                    description={fine.description}
                    person={fine.user ? { name: fine.user.name, image: memberById.get(fine.user.id)?.user.image } : null}
                    meta={`${formatRelativePast(fine.createdAt)}${creatorName(fine) ? ` · foreslået af ${creatorName(fine)}` : ""}`}
                    amount={fine.amount}
                    event={selecting ? null : fine.event}
                    select={selectFor("fine", fine.id)}
                    actions={decisionButtons("fine", fine.id)}
                  />
                ))}
              </ListGroup>
            </div>
          ) : null}

          {pendingTemplates.length > 0 ? (
            <div className="space-y-1.5">
              {groupHeader("Nye bøder til kataloget", "template", templateKeys)}
              <ListGroup>
                {pendingTemplates.map((template) => (
                  <FineRow
                    key={template.id}
                    title={template.title}
                    description={template.description}
                    meta={`${categoryLabel[template.category] ?? ""}${template.createdBy?.name ? ` · foreslået af ${template.createdBy.name}` : ""}`}
                    amount={template.amount}
                    select={selectFor("template", template.id)}
                    actions={decisionButtons("template", template.id)}
                  />
                ))}
              </ListGroup>
            </div>
          ) : null}

          {selecting ? <div className="h-20" aria-hidden /> : null}
        </div>
      )}

      {mounted && actionBar ? createPortal(actionBar, document.body) : null}

      <ConfirmSheet
        open={Boolean(confirm)}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={decideMany}
        loading={busy}
        tone={confirm?.approve ? "primary" : "danger"}
        title={`${confirm?.approve ? "Godkend" : "Afvis"} ${confirmTargets.length} ${noun}?`}
        description={
          busy && progress
            ? `Behandler ${progress.done} af ${progress.total}…`
            : confirm?.approve
              ? `I alt ${formatKr(confirmTotal)}. Godkendte bøder bliver sat på spillerne med det samme.`
              : `I alt ${formatKr(confirmTotal)}. Afviste forslag forsvinder fra indbakken.`
        }
        confirmLabel={confirm?.approve ? `Godkend ${confirmTargets.length}` : `Afvis ${confirmTargets.length}`}
      />
    </Section>
  );
}
