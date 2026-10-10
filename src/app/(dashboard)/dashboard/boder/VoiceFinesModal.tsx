"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Sheet from "@/components/ui/Sheet";
import { inputClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import {
  emptyParseUsage,
  emptyTranscribeUsage,
  parseCostUsd,
  transcribeCostUsd,
  usdToDkk,
  type ParseUsage,
  type TranscribeUsage
} from "@/lib/voiceFines/pricing";
import type { FineTemplate, Member } from "./boderTypes";
import { parseIntegerAmountInput } from "./boderUtils";
import { useHoldToTalk } from "./useHoldToTalk";

type Row = {
  key: string;
  userId: string;
  templateId: string;
  title: string;
  amount: string;
  confidence: number;
  sourceText: string;
};

type Props = {
  open?: boolean;
  teamId: string;
  members: Member[];
  templates: FineTemplate[];
  onClose: () => void;
  /** Skift til den almindelige "Giv bøde"-formular. */
  onManual?: () => void;
  onCreated: () => Promise<void> | void;
};

let rowCounter = 0;
const nextKey = () => `row-${++rowCounter}`;

export function VoiceFinesModal({ open = true, teamId, members, templates, onClose, onManual, onCreated }: Props) {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [transcribeUsage, setTranscribeUsage] = useState<TranscribeUsage>(emptyTranscribeUsage);
  const [parseUsage, setParseUsage] = useState<ParseUsage>(emptyParseUsage);
  const rowsRef = useRef<Row[]>([]);
  const commitRows = useCallback((next: Row[]) => {
    rowsRef.current = next;
    setRows(next);
  }, []);

  const approved = useMemo(() => templates.filter((t) => !t.status || t.status === "APPROVED"), [templates]);
  const memberOptions = useMemo(
    () => members.map((m) => ({ value: m.user.id, label: m.user.name })),
    [members]
  );
  const templateOptions = useMemo(
    () => [
      { value: "", label: "Fri bøde (egen titel)" },
      ...approved.map((t) => ({ value: t.id, label: t.title, rightLabel: `${t.amount} kr` }))
    ],
    [approved]
  );
  const nameById = useMemo(() => new Map(members.map((m) => [m.user.id, m.user.name])), [members]);
  const imageById = useMemo(
    () => new Map(members.map((m) => [m.user.id, (m.user as { image?: string | null }).image ?? null])),
    [members]
  );

  const { recording, connecting, busy, start, finish, cancel } = useHoldToTalk({
    teamId,
    existing: () => rowsRef.current.map((row) => ({ userId: row.userId, title: row.title, amount: Number(row.amount) || null })),
    onTranscript: (text) => setTranscripts((current) => [...current, text]),
    onSuggestions: (suggestions) => {
      const remaining = Math.max(0, 200 - rowsRef.current.length);
      commitRows([...rowsRef.current, ...suggestions.slice(0, remaining).map((fine) => ({
        key: nextKey(), userId: fine.userId, templateId: fine.templateId ?? "", title: fine.title,
        amount: fine.amount === null ? "" : String(fine.amount), confidence: fine.confidence, sourceText: fine.sourceText
      }))]);
      if (!suggestions.length) pushToast("Ingen bødeanmodning genkendt. Prøv igen eller tilføj manuelt.", "error");
      if (suggestions.length > remaining) pushToast("Der kan højst være 200 forslag. Resten blev ikke tilføjet.", "error");
    },
    onTranscribeUsage: (usage) => setTranscribeUsage((current) => ({
      audioIn: current.audioIn + usage.audioIn, textIn: current.textIn + usage.textIn, textOut: current.textOut + usage.textOut
    })),
    onParseUsage: (usage) => setParseUsage((current) => ({
      input: current.input + usage.input, output: current.output + usage.output,
      cacheRead: current.cacheRead + usage.cacheRead, cacheWrite: current.cacheWrite + usage.cacheWrite
    })),
    onError: (message) => pushToast(message, "error")
  });

  const updateRow = (key: string, patch: Partial<Row>) =>
    commitRows(rowsRef.current.map((r) => r.key === key ? { ...r, ...patch, confidence: 1 } : r));
  const removeRow = (key: string) => commitRows(rowsRef.current.filter((r) => r.key !== key));
  const addEmptyRow = () =>
    commitRows([...rowsRef.current, { key: nextKey(), userId: "", templateId: "", title: "", amount: "", confidence: 1, sourceText: "" }]);

  function selectTemplate(key: string, templateId: string) {
    const template = approved.find((t) => t.id === templateId);
    updateRow(key, {
      templateId,
      title: template ? template.title : "",
      amount: template ? String(template.amount) : ""
    });
  }

  const rowValid = (r: Row) =>
    Boolean(r.userId) &&
    (r.templateId ? true : r.title.trim().length > 0 && parseIntegerAmountInput(r.amount).ok && Number(r.amount) !== 0);
  const allValid = rows.length > 0 && rows.every(rowValid);

  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const id = row.userId || "";
      if (!map.has(id)) {
        map.set(id, []);
        order.push(id);
      }
      map.get(id)!.push(row);
    }
    return order.map((id) => ({ userId: id, rows: map.get(id)! }));
  }, [rows]);

  const total = rows.reduce((sum, r) => sum + (r.templateId ? (approved.find((t) => t.id === r.templateId)?.amount ?? 0) : Number(r.amount) || 0), 0);

  const costUsd = transcribeCostUsd(transcribeUsage) + parseCostUsd(parseUsage);
  const tokenTotal =
    transcribeUsage.audioIn + transcribeUsage.textIn + transcribeUsage.textOut +
    Object.values(parseUsage).reduce((sum, n) => sum + n, 0);

  async function handleConfirm() {
    if (!allValid || submitting || recording || busy || connecting) return;
    cancel();
    setSubmitting(true);
    try {
      const results = await Promise.all(
        rows.map((r) =>
          fetch("/api/fines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              r.templateId
                ? { teamId, userId: r.userId, templateId: r.templateId }
                : { teamId, userId: r.userId, title: r.title.trim(), amount: Number(r.amount) }
            )
          }).then((res) => ({ key: r.key, ok: res.ok }))
        )
      );
      const failed = new Set(results.filter((r) => !r.ok).map((r) => r.key));
      await onCreated();
      if (failed.size === 0) {
        pushToast(`${rows.length} bøder tildelt`, "success");
        onClose();
      } else {
        commitRows(rowsRef.current.filter((r) => failed.has(r.key)));
        pushToast(`${failed.size} bøder kunne ikke oprettes – de er beholdt så du kan prøve igen`, "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const locked = recording || connecting || busy || submitting;
  const statusText = connecting
    ? "Tillad mikrofonen og hold knappen nede"
    : recording
      ? "Optager – slip for at lave forslag"
      : busy
        ? "Laver forslag…"
        : "Hold knappen nede og rems bøderne op";

  return (
    <Sheet
      open={open}
      onClose={() => {
        cancel();
        onClose();
      }}
      dismissible={!locked}
      title="Giv bøde"
      description="Fx “Mikkel for sent, Jonas glemte vestene”."
      footer={
        <div className="space-y-2">
          <Button
            block
            size="lg"
            icon="check"
            disabled={!allValid || recording || busy || connecting}
            loading={submitting}
            onClick={handleConfirm}
          >
            {rows.length ? `Giv ${rows.length} bøde${rows.length === 1 ? "" : "r"} · ${total.toLocaleString("da-DK")} kr` : "Ingen forslag endnu"}
          </Button>
          <p className="text-center text-xs text-ink/45">
            {tokenTotal.toLocaleString("da-DK")} tokens · ≈ {usdToDkk(costUsd).toFixed(2).replace(".", ",")} kr
          </p>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 pb-2">
        <button
          type="button"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            void start();
          }}
          onPointerUp={() => finish()}
          onPointerCancel={() => cancel()}
          onLostPointerCapture={() => finish()}
          onKeyDown={(event) => {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            if (!event.repeat) void start();
          }}
          onKeyUp={(event) => {
            if (event.key === " " || event.key === "Enter") { event.preventDefault(); finish(); }
          }}
          onBlur={() => finish()}
          onContextMenu={(event) => event.preventDefault()}
          disabled={busy || submitting}
          aria-pressed={recording}
          aria-label="Hold nede for at indtale bøder"
          style={{ touchAction: "none", userSelect: "none" }}
          className={cn(
            "relative flex h-24 w-24 select-none items-center justify-center rounded-full text-on-primary transition duration-200 disabled:opacity-50",
            recording
              ? "scale-110 bg-out shadow-[0_0_0_10px_color-mix(in_srgb,var(--out)_20%,transparent),0_0_0_22px_color-mix(in_srgb,var(--out)_10%,transparent)]"
              : "bg-primary shadow-[0_16px_32px_-12px_var(--primary)] active:scale-95"
          )}
        >
          {connecting || busy ? (
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-on-primary/30 border-t-on-primary" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
            </svg>
          )}
        </button>
        <p className="font-display text-lg font-bold uppercase tracking-wide text-ink" role="status">
          {statusText}
        </p>
        {transcripts.length ? (
          <div className="w-full space-y-1.5 rounded-2xl bg-ink/[0.04] px-4 py-3 text-sm text-ink/75" role="log" aria-label="Transskription">
            {transcripts.map((text, index) => (
              <p key={index} className="whitespace-pre-wrap">“{text}”</p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {grouped.length > 0 ? (
          <p className="text-sm text-ink/55">Tjek spillere og beløb. Usikre forslag er markeret med gult.</p>
        ) : null}
        {grouped.map((group) => (
          <div key={group.userId || "ukendt"} className="overflow-hidden rounded-2xl border border-line">
            <div className="flex items-center gap-2.5 bg-ink/[0.03] px-3 py-2">
              <Avatar name={nameById.get(group.userId) ?? "?"} image={imageById.get(group.userId)} size="sm" />
              <p className="min-w-0 flex-1 truncate font-semibold text-ink">{nameById.get(group.userId) ?? "Vælg spiller"}</p>
              <span className="text-xs font-semibold text-ink/50">
                {group.rows.length} bøde{group.rows.length === 1 ? "" : "r"}
              </span>
            </div>
            <div className="divide-y divide-line">
              {group.rows.map((row) => (
                <div
                  key={row.key}
                  className={cn("space-y-2 p-3", (row.confidence < 0.6 || !rowValid(row)) && "bg-pending/[0.08]")}
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Combobox
                      value={row.userId}
                      onChange={(v) => updateRow(row.key, { userId: v })}
                      options={memberOptions}
                      placeholder="Spiller"
                      searchPlaceholder="Søg spiller…"
                    />
                    <Combobox
                      value={row.templateId}
                      onChange={(v) => selectTemplate(row.key, v)}
                      options={templateOptions}
                      placeholder="Bødetype"
                      searchPlaceholder="Søg bødetype…"
                    />
                  </div>
                  {!row.templateId ? (
                    <div className="grid grid-cols-[1fr_6rem] gap-2">
                      <input className={inputClass} placeholder="Hvad er bøden for?" value={row.title} onChange={(e) => updateRow(row.key, { title: e.target.value })} />
                      <input className={inputClass} inputMode="numeric" placeholder="Kr" value={row.amount} onChange={(e) => updateRow(row.key, { amount: e.target.value })} />
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-ink/50">
                      {row.confidence < 0.6 ? <strong className="text-pending">Usikker · </strong> : null}
                      {row.sourceText ? `“${row.sourceText}”` : ""}
                    </span>
                    <button type="button" className="inline-flex shrink-0 items-center gap-1 font-semibold text-out" onClick={() => removeRow(row.key)}>
                      <Icon name="x" className="h-3.5 w-3.5" />
                      Fjern
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Button block variant="secondary" icon="plus" onClick={addEmptyRow}>
          Tilføj bøde manuelt
        </Button>
        {onManual ? (
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              cancel();
              onManual();
            }}
            className="w-full py-2 text-center text-sm font-semibold text-moss disabled:opacity-50"
          >
            Brug den almindelige formular
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}
