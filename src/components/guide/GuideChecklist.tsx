"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { Card } from "@/components/ui/primitives";
import { nextGuideSteps, type GuideState } from "@/lib/guide/state";
import GuideStepList from "@/components/guide/GuideStepList";
import type { GuideAction } from "@/components/guide/guideClient";

/** Så mange trin vises ad gangen, så det ikke føles som en lang huskeliste */
const NEXT_COUNT = 3;

const HIGHLIGHT_MS = 2500;

export function ProgressRing({ done, total, className }: { done: number; total: number; className?: string }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? done / total : 0;
  return (
    <span className={cn("relative inline-flex h-14 w-14 shrink-0 items-center justify-center", className)}>
      <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="5" className="stroke-ink/10" />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute font-display text-base font-bold tabular-nums text-ink">
        {done}/{total}
      </span>
    </span>
  );
}

/** "Kom i gang"-kortet på forsiden: de næste par trin, og resten bag "Vis alle". */
export default function GuideChecklist({
  state,
  act,
  highlight,
  onDismiss
}: {
  state: GuideState;
  act: (action: GuideAction, stepId?: string) => Promise<boolean>;
  /** Lige startet fra velkomsten – scroll kortet frem og fremhæv det */
  highlight?: boolean;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);
  const [glow, setGlow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlight) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setGlow(true);
    const timer = window.setTimeout(() => setGlow(false), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  const { summary } = state;
  const next = nextGuideSteps(state.steps, NEXT_COUNT);
  const finished = summary.todo === 0;

  return (
    <section aria-label="Kom i gang" ref={ref}>
      <Card className={cn("overflow-hidden p-0 ring-primary/60 transition-shadow duration-700 sm:p-0", glow ? "ring-2" : "ring-0")}>
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <ProgressRing done={summary.done} total={summary.total} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[1.375rem] font-bold uppercase leading-none tracking-wide text-ink">
              {finished ? "Du er klar 🎉" : "Kom i gang"}
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {finished
                ? "Du har været det hele igennem."
                : summary.todo === 1
                  ? "1 ting tilbage"
                  : `${summary.todo} ting tilbage`}
            </p>
          </div>
          {finished ? null : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmHide(true)}>
              Skjul
            </Button>
          )}
        </div>

        {finished ? (
          <div className="flex flex-wrap gap-2 border-t border-line p-4 sm:px-5">
            <Button size="sm" onClick={onDismiss}>
              Luk guiden
            </Button>
            {summary.skipped > 0 ? (
              <Button size="sm" variant="secondary" onClick={() => setExpanded(true)}>
                Se de oversprungne
              </Button>
            ) : null}
          </div>
        ) : null}

        {!finished || expanded ? (
          <div className="border-t border-line pb-2 pt-1">
            {expanded ? (
              <div className="pt-3">
                <GuideStepList steps={state.steps} act={act} grouped />
              </div>
            ) : (
              <GuideStepList steps={next} act={act} />
            )}
            {state.steps.length > NEXT_COUNT ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mx-4 mt-1 min-h-10 text-sm font-semibold text-moss hover:underline"
              >
                {expanded ? "Vis færre" : `Vis alle (${state.steps.length})`}
              </button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <ConfirmSheet
        open={confirmHide}
        onClose={() => setConfirmHide(false)}
        onConfirm={() => {
          setConfirmHide(false);
          onDismiss();
        }}
        title="Skjul guiden?"
        description="Du kan altid finde den igen under Profil."
        confirmLabel="Skjul guiden"
        tone="primary"
      />
    </section>
  );
}
