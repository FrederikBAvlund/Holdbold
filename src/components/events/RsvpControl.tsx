"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import Button, { Spinner } from "@/components/ui/Button";
import { useToast } from "@/components/ToastProvider";
import {
  isDeadlinePassed,
  isPast,
  materializeEvent,
  postSignup,
  type CalendarEvent,
  type SignupStatus
} from "@/lib/events/client";

const QUICK_REASONS = ["Syg", "Skadet", "Arbejde", "Familie", "Ferie", "Studie"];

type Variant = "hero" | "card" | "compact";

export default function RsvpControl({
  teamId,
  userId,
  event,
  status,
  onSaved,
  variant = "card",
  className
}: {
  teamId: string;
  userId: string;
  event: Pick<CalendarEvent, "id" | "seriesId" | "date" | "signupDeadline" | "canceledAt" | "title">;
  status: SignupStatus | null | undefined;
  onSaved?: (next: { status: SignupStatus; eventId: string; reason?: string }) => void;
  variant?: Variant;
  className?: string;
}) {
  const { pushToast } = useToast();
  const [saving, setSaving] = useState<SignupStatus | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");

  const current: SignupStatus = status === "IN" || status === "OUT" ? status : "UNKNOWN";
  const locked = Boolean(event.canceledAt) || isPast(event);
  const latePenalty = !locked && isDeadlinePassed(event);

  async function save(next: SignupStatus, nextReason?: string) {
    setSaving(next);
    try {
      const eventId = await materializeEvent(teamId, event);
      await postSignup(eventId, { userId, status: next, reason: nextReason });
      pushToast(next === "IN" ? "Du er meldt til 💪" : "Afbud sendt", "success");
      onSaved?.({ status: next, eventId, reason: nextReason });
      setReasonOpen(false);
      setReason("");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Kunne ikke gemme dit svar", "error");
    } finally {
      setSaving(null);
    }
  }

  if (locked) {
    return (
      <p
        className={cn(
          "text-sm font-medium",
          variant === "hero" ? "text-on-primary/80" : "text-ink/55",
          className
        )}
      >
        {event.canceledAt
          ? "Begivenheden er aflyst."
          : current === "IN"
            ? "Du var meldt til."
            : current === "OUT"
              ? "Du havde meldt afbud."
              : "Begivenheden er startet – svar er lukket."}
      </p>
    );
  }

  const onHero = variant === "hero";
  const compact = variant === "compact";

  const base = cn(
    "relative inline-flex flex-1 items-center justify-center gap-2 font-semibold transition active:scale-[0.97] disabled:opacity-60",
    compact ? "min-h-10 rounded-xl px-3 text-sm" : "min-h-[3.25rem] rounded-2xl px-4 text-base"
  );

  function tone(kind: "IN" | "OUT") {
    const selected = current === kind;
    if (onHero) {
      if (selected) return kind === "IN" ? "bg-white text-[#0b0f14]" : "bg-[#0b0f14]/35 text-white ring-2 ring-white/70";
      return "bg-on-primary/15 text-on-primary hover:bg-on-primary/25";
    }
    if (selected) return kind === "IN" ? "bg-in text-on-solid" : "bg-out text-on-solid";
    return kind === "IN" ? "bg-in/12 text-in hover:bg-in/20" : "bg-out/10 text-out hover:bg-out/15";
  }

  return (
    <div className={cn("season-lock space-y-2", className)}>
      <div className="flex gap-2">
        <button
          type="button"
          className={cn(base, tone("IN"))}
          disabled={saving !== null}
          aria-pressed={current === "IN"}
          onClick={() => current !== "IN" && save("IN")}
        >
          {saving === "IN" ? <Spinner /> : <Icon name="check" className="h-5 w-5" strokeWidth={2.6} />}
          {current === "IN" ? "Du kommer" : "Kommer"}
        </button>
        <button
          type="button"
          className={cn(base, tone("OUT"))}
          disabled={saving !== null}
          aria-pressed={current === "OUT"}
          onClick={() => setReasonOpen(true)}
        >
          {saving === "OUT" ? <Spinner /> : <Icon name="x" className="h-5 w-5" strokeWidth={2.6} />}
          {current === "OUT" ? "Afbud meldt" : "Kan ikke"}
        </button>
      </div>
      {latePenalty && !compact ? (
        <p className={cn("flex items-center gap-1.5 text-xs font-medium", onHero ? "text-on-primary/85" : "text-pending")}>
          <Icon name="alert" className="h-3.5 w-3.5" />
          Svarfristen er overskredet – en ændring nu kan give en bøde.
        </p>
      ) : null}

      <Sheet
        open={reasonOpen}
        onClose={() => setReasonOpen(false)}
        title="Melder du afbud?"
        description={`${event.title} – fortæl holdet hvorfor.`}
        dismissible={saving === null}
        footer={
          <Button
            block
            size="lg"
            className="bg-out text-on-solid shadow-none"
            loading={saving === "OUT"}
            disabled={reason.trim().length < 2}
            onClick={() => save("OUT", reason)}
          >
            Send afbud
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS.map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => setReason(quick)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm font-semibold transition active:scale-95",
                  reason === quick ? "border-ink bg-ink text-bg" : "border-line text-ink/75 hover:border-ink/30"
                )}
              >
                {quick}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Eller skriv selv…"
            className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-ink/40 focus:border-moss focus:outline-none focus:ring-4 focus:ring-moss/15"
          />
          {latePenalty ? (
            <p className="flex items-start gap-2 rounded-2xl bg-pending/12 px-3.5 py-3 text-sm text-ink/80">
              <Icon name="alert" className="mt-0.5 h-4 w-4 text-pending" />
              Svarfristen er overskredet. Afbud nu kan udløse en bøde.
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
