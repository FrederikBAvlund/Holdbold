"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet, { ConfirmSheet } from "@/components/ui/Sheet";
import { Field, Skeleton, inputClass } from "@/components/ui/primitives";
import { patchEvent, type EventDetail, type EventKind } from "@/lib/events/client";
import { mergeHistory, toDateTimeLocalValue, type EventLog, type SignupLog } from "@/lib/events/eventUtils";
import { formatRelativePast } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = { IN: "meldte til", OUT: "meldte afbud", UNKNOWN: "satte til mangler svar" };

export function EventAdminSheet({
  open,
  onClose,
  event,
  canEditMeta,
  onUpdated,
  onOpenHistory
}: {
  open: boolean;
  onClose: () => void;
  event: EventDetail;
  canEditMeta: boolean;
  onUpdated: (patch: Partial<EventDetail>) => void;
  onOpenHistory: () => void;
}) {
  const { pushToast } = useToast();
  const [kind, setKind] = useState<EventKind>(event.kind);
  const [meeting, setMeeting] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState<"kind" | "meta" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const canceled = Boolean(event.canceledAt);
  const deadlinePassed = Boolean(event.signupDeadline && new Date(event.signupDeadline).getTime() <= Date.now());

  useEffect(() => {
    if (!open) return;
    setKind(event.kind);
    setMeeting(
      toDateTimeLocalValue(event.meetingTime ?? new Date(new Date(event.date).getTime() - 60 * 60 * 1000))
    );
    setDeadline(toDateTimeLocalValue(event.signupDeadline));
  }, [open, event]);

  async function saveKind(next: EventKind) {
    setKind(next);
    setSaving("kind");
    try {
      const data = await patchEvent(event.id, { kind: next });
      onUpdated({ kind: data.event?.kind ?? next });
      pushToast(next === "MATCH" ? "Ændret til kamp" : "Ændret til træning", "success");
    } catch (err) {
      setKind(event.kind);
      pushToast(err instanceof Error ? err.message : "Kunne ikke ændre type", "error");
    } finally {
      setSaving(null);
    }
  }

  async function saveMeta() {
    const meetingDate = meeting ? new Date(meeting) : null;
    const deadlineDate = deadline ? new Date(deadline) : null;
    if ((meetingDate && Number.isNaN(meetingDate.getTime())) || (deadlineDate && Number.isNaN(deadlineDate.getTime()))) {
      pushToast("Ugyldigt tidspunkt", "error");
      return;
    }
    setSaving("meta");
    try {
      const body: Record<string, unknown> = { meetingTime: meetingDate ? meetingDate.toISOString() : null };
      if (!deadlinePassed && deadlineDate) body.signupDeadline = deadlineDate.toISOString();
      const data = await patchEvent(event.id, body);
      onUpdated({
        meetingTime: data.event?.meetingTime ?? null,
        signupDeadline: data.event?.signupDeadline ?? event.signupDeadline
      });
      pushToast("Tider gemt", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke gemme", "error");
    } finally {
      setSaving(null);
    }
  }

  async function toggleCanceled() {
    setSaving("cancel");
    try {
      const response = await fetch(`/api/events/${event.id}/${canceled ? "reopen" : "cancel"}`, { method: "POST" });
      if (!response.ok) throw new Error(canceled ? "Kunne ikke genåbne" : "Kunne ikke aflyse");
      const data = await response.json().catch(() => ({}));
      onUpdated({ canceledAt: canceled ? null : data.event?.canceledAt ?? new Date().toISOString() });
      pushToast(canceled ? "Begivenheden er genåbnet" : "Begivenheden er aflyst", "success");
      setConfirmCancel(false);
      onClose();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Noget gik galt", "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <Sheet open={open && !confirmCancel} onClose={onClose} title="Administrér" description={event.title}>
        <div className="space-y-6">
          {!canceled ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink/80">Type</p>
              <div className="grid grid-cols-2 gap-2">
                {(["TRAINING", "MATCH"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={saving === "kind"}
                    onClick={() => option !== kind && saveKind(option)}
                    aria-pressed={kind === option}
                    className={cn(
                      "flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 font-display text-lg font-bold uppercase transition active:scale-[0.98]",
                      kind === option ? "border-moss bg-moss/10 text-ink" : "border-line text-ink/60"
                    )}
                  >
                    <Icon name={option === "MATCH" ? "ball" : "whistle"} />
                    {option === "MATCH" ? "Kamp" : "Træning"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {kind === "MATCH" && canEditMeta && !canceled ? (
            <div className="space-y-3">
              <Field label="Mødetid" htmlFor="meeting">
                <input id="meeting" type="datetime-local" value={meeting} onChange={(e) => setMeeting(e.target.value)} className={inputClass} />
              </Field>
              <Field
                label="Svarfrist"
                htmlFor="deadline"
                hint={deadlinePassed ? "Fristen er passeret og kan ikke længere ændres." : undefined}
              >
                <input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  disabled={deadlinePassed}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={cn(inputClass, deadlinePassed && "opacity-50")}
                />
              </Field>
              <Button block variant="secondary" loading={saving === "meta"} onClick={saveMeta}>
                Gem tider
              </Button>
            </div>
          ) : null}

          <div className="space-y-2 border-t border-line pt-5">
            <Button block variant="secondary" icon="list" onClick={onOpenHistory}>
              Se historik
            </Button>
            {canceled ? (
              <Button block variant="success" loading={saving === "cancel"} onClick={toggleCanceled}>
                Genåbn begivenhed
              </Button>
            ) : (
              <Button block variant="danger" icon="x" onClick={() => setConfirmCancel(true)}>
                Aflys begivenhed
              </Button>
            )}
          </div>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={toggleCanceled}
        loading={saving === "cancel"}
        title="Aflys begivenheden?"
        description="Holdet får besked, og begivenheden vises som aflyst. Du kan genåbne den igen."
        confirmLabel="Ja, aflys"
      />
    </>
  );
}

export function HistorySheet({
  open,
  onClose,
  logs,
  eventLogs
}: {
  open: boolean;
  onClose: () => void;
  logs: SignupLog[] | null;
  eventLogs: EventLog[] | null;
}) {
  const entries = logs && eventLogs ? mergeHistory(logs, eventLogs) : null;
  return (
    <Sheet open={open} onClose={onClose} title="Historik" description="Alle svar og ændringer, nyeste først.">
      {entries === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink/55">Ingen aktivitet endnu.</p>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-line pl-5">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full ring-4 ring-surface",
                  entry.type === "SIGNUP"
                    ? entry.status === "IN"
                      ? "bg-in"
                      : entry.status === "OUT"
                        ? "bg-out"
                        : "bg-pending"
                    : "bg-ink/40"
                )}
              />
              <div className="flex items-start gap-2">
                <Avatar name={entry.name} image={entry.image} size="xs" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    <span className="font-semibold">{entry.name}</span>{" "}
                    {entry.type === "SIGNUP" ? STATUS_LABEL[entry.status ?? ""] ?? "opdaterede" : entry.message}
                  </p>
                  {entry.reason ? <p className="text-sm text-ink/60">“{entry.reason}”</p> : null}
                  <p className="mt-0.5 text-xs text-ink/45">
                    {formatRelativePast(entry.createdAt)}
                    {entry.late ? <span className="ml-1.5 font-semibold text-pending">· efter fristen</span> : null}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}
