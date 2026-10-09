"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import LoadingButton from "@/components/LoadingButton";
import { useToast } from "@/components/ToastProvider";
import type { VoiceSuggestion } from "@/lib/voiceFines/matching";
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
import { useRealtimeTranscription } from "./useRealtimeTranscription";

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
  const [segments, setSegments] = useState<string[]>([]);
  const [pendingParses, setPendingParses] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [transcribeUsage, setTranscribeUsage] = useState<TranscribeUsage>(emptyTranscribeUsage);
  const [parseUsage, setParseUsage] = useState<ParseUsage>(emptyParseUsage);

  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;
  const segmentsRef = useRef<string[]>([]);
  segmentsRef.current = segments;
  const queueRef = useRef<Promise<void>>(Promise.resolve());

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

  const addSuggestions = useCallback((suggestions: VoiceSuggestion[]) => {
    if (!suggestions.length) return;
    setRows((prev) => [
      ...prev,
      ...suggestions.map((s) => ({
        key: nextKey(),
        userId: s.userId,
        templateId: s.templateId ?? "",
        title: s.title,
        amount: s.amount === null ? "" : String(s.amount),
        confidence: s.confidence,
        sourceText: s.sourceText
      }))
    ]);
  }, []);

  // Segmenter fortolkes i rækkefølge, så "allerede foreslået" altid er opdateret.
  const handleSegment = useCallback(
    (text: string) => {
      const context = segmentsRef.current.slice(-2).join(" ");
      setSegments((prev) => [...prev, text]);
      setPendingParses((n) => n + 1);
      queueRef.current = queueRef.current.then(async () => {
        try {
          const response = await fetch("/api/fines/voice/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId,
              segment: text,
              context,
              existing: rowsRef.current.map((r) => ({
                userId: r.userId,
                title: r.title,
                amount: parseIntegerAmountInput(r.amount).ok ? Number(r.amount) : null
              }))
            })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            pushToast(data.error ?? "Kunne ikke fortolke udsagn", "error");
            return;
          }
          addSuggestions(data.suggestions ?? []);
          if (data.usage) {
            setParseUsage((u) => ({
              input: u.input + data.usage.input,
              output: u.output + data.usage.output,
              cacheRead: u.cacheRead + data.usage.cacheRead,
              cacheWrite: u.cacheWrite + data.usage.cacheWrite
            }));
          }
        } finally {
          setPendingParses((n) => n - 1);
        }
      });
    },
    [teamId, addSuggestions, pushToast]
  );

  const { recording, connecting, liveText, start, stop } = useRealtimeTranscription({
    teamId,
    onSegment: handleSegment,
    onUsage: (usage) =>
      setTranscribeUsage((u) => ({
        audioIn: u.audioIn + usage.audioIn,
        textIn: u.textIn + usage.textIn,
        textOut: u.textOut + usage.textOut
      })),
    onError: (message) => pushToast(message, "error")
  });

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch, confidence: 1 } : r)));
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));
  const addEmptyRow = () =>
    setRows((prev) => [...prev, { key: nextKey(), userId: "", templateId: "", title: "", amount: "", confidence: 1, sourceText: "" }]);

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
    parseUsage.input + parseUsage.output + parseUsage.cacheRead + parseUsage.cacheWrite;

  async function handleConfirm() {
    if (!allValid || submitting) return;
    stop();
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
        setRows((prev) => prev.filter((r) => failed.has(r.key)));
        pushToast(`${failed.size} bøder kunne ikke oprettes – de er beholdt så du kan prøve igen`, "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => (!recording && !submitting ? onClose() : undefined)}>
      <div className="modal-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-ink">Indtal bøder</h3>
          <button type="button" className="btn-ghost" onClick={() => { stop(); onClose(); }} disabled={submitting}>
            Luk
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={recording ? stop : start}
            disabled={connecting || submitting}
            aria-pressed={recording}
            className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white shadow-lg transition ${
              recording ? "animate-pulse bg-red-600" : "bg-ink"
            } disabled:opacity-50`}
          >
            {connecting ? "…" : recording ? "■" : "🎤"}
          </button>
          <p className="text-sm text-ink/70">
            {connecting ? "Forbinder…" : recording ? "Lytter – tryk for at stoppe" : "Tryk for at tale. Rems bøder op, fx “Mikkel for sent, Jonas glemte veste”."}
          </p>
          <div className="min-h-[2.5rem] w-full rounded-xl border border-ink/10 bg-white/60 p-2 text-sm text-ink/80">
            {segments.slice(-3).map((s, i) => (
              <p key={`${i}-${s}`} className="text-ink/50">{s}</p>
            ))}
            {liveText ? <p>{liveText}</p> : null}
            {!segments.length && !liveText ? <span className="text-ink/40">Transskription vises her…</span> : null}
          </div>
        </div>

        <div className="mt-4 space-y-3">
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
                        {row.confidence < 0.6 ? "Usikker – tjek · " : ""}
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
          {pendingParses > 0 ? <p className="text-sm text-ink/60">Fortolker…</p> : null}
          {!rows.length && pendingParses === 0 ? (
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
            {parseUsage.input + parseUsage.output + parseUsage.cacheRead + parseUsage.cacheWrite}
          </p>
          <LoadingButton
            type="button"
            className="btn-primary"
            disabled={!allValid || pendingParses > 0}
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
