"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import LoadingButton from "@/components/LoadingButton";
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
  teamId: string;
  members: Member[];
  templates: FineTemplate[];
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

let rowCounter = 0;
const nextKey = () => `row-${++rowCounter}`;

export function VoiceFinesModal({ teamId, members, templates, onClose, onCreated }: Props) {
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

  return (
    <div className="modal-backdrop" onClick={() => (!recording && !connecting && !busy && !submitting ? onClose() : undefined)}>
      <div className="modal-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-ink">Indtal bøder</h3>
          <button type="button" className="btn-ghost" onClick={() => { cancel(); onClose(); }} disabled={submitting}>
            Luk
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-3">
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
            className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white shadow-lg transition ${
              recording ? "animate-pulse bg-red-600" : "bg-ink"
            } disabled:opacity-50`}
          >
            {connecting || busy ? "…" : recording ? "■" : "🎤"}
          </button>
          <p className="text-sm text-ink/70" role="status">
            {connecting ? "Tillad mikrofonen og hold knappen nede" : recording ? "Optager – slip for at oprette forslag" : busy ? "Behandler optagelsen…" : "Hold knappen nede, mens du taler. Slip for at oprette bødeforslag."}
          </p>
          <div className="min-h-[2.5rem] w-full space-y-2 rounded-xl border border-ink/10 bg-white/60 p-3 text-sm text-ink/80" role="log" aria-label="Transskription">
            {transcripts.map((text, index) => <p key={index} className="whitespace-pre-wrap">{text}</p>)}
            {!transcripts.length ? <span className="text-ink/40">Din transskription vises her og bruges til bødeforslagene.</span> : null}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink/60">Tjek spillere og beløb før tildeling. Usikre match og vurderede beløb markeres i listen.</p>
          {grouped.map((group) => (
            <div key={group.userId || "ukendt"} className="rounded-xl border border-ink/10 bg-white/70 p-3">
              <p className="mb-2 text-sm font-semibold text-ink">
                {nameById.get(group.userId) ?? "Vælg spiller"} · {group.rows.length} bøde{group.rows.length === 1 ? "" : "r"}
              </p>
              <div className="space-y-2">
                {group.rows.map((row) => (
                  <div
                    key={row.key}
                    className={`space-y-2 rounded-lg border p-2 ${row.confidence < 0.6 || !rowValid(row) ? "border-amber-400 bg-amber-50/60" : "border-ink/10"}`}
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
                        <input className="input" placeholder="Titel" value={row.title} onChange={(e) => updateRow(row.key, { title: e.target.value })} />
                        <input className="input" inputMode="numeric" placeholder="Kr" value={row.amount} onChange={(e) => updateRow(row.key, { amount: e.target.value })} />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-2 text-xs text-ink/50">
                      <span className="truncate">
                        {row.confidence < 0.6 ? "Vurderet / usikker – tjek · " : ""}
                        {row.sourceText ? `“${row.sourceText}”` : ""}
                      </span>
                      <button type="button" className="shrink-0 text-red-700 underline" onClick={() => removeRow(row.key)}>
                        Fjern
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {busy ? <p className="text-sm text-ink/60">Opretter bødeforslag…</p> : null}
          {!rows.length && !busy ? (
            <p className="text-sm text-ink/50">Ingen forslag endnu.</p>
          ) : null}
          <button type="button" className="btn-ghost w-full" onClick={addEmptyRow}>
            + Tilføj bøde manuelt
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink/60">
            {tokenTotal.toLocaleString("da-DK")} tokens · ≈ {usdToDkk(costUsd).toFixed(2).replace(".", ",")} kr
            <br />
            Transskription {transcribeUsage.audioIn + transcribeUsage.textIn + transcribeUsage.textOut} · Fortolkning{" "}
            {Object.values(parseUsage).reduce((sum, n) => sum + n, 0)}
          </p>
          <LoadingButton
            type="button"
            className="btn-primary"
            disabled={!allValid || recording || busy || connecting}
            isLoading={submitting}
            onClick={handleConfirm}
            idleContent={`Tildel ${rows.length} bøder (${total} kr)`}
            loadingContent="Tildeler…"
          />
        </div>
      </div>
    </div>
  );
}
