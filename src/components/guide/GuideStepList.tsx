"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SetupGuideSheet } from "@/components/SetupGuide";
import Icon from "@/components/ui/Icon";
import { capabilities } from "@/lib/guide/capabilities";
import type { GuideStepState } from "@/lib/guide/state";
import { CAPABILITY_META } from "@/components/guide/guideMeta";
import { refreshGuide, type GuideAction } from "@/components/guide/guideClient";

/** Push og hjemmeskærm har sin egen guide, som åbnes direkte i stedet for at sende brugeren videre. */
const PUSH_STEP_ID = "basis.push";

function statusText(step: GuideStepState) {
  if (step.status === "done") return step.doneBy === "team" ? "Holdet har det allerede" : "Klaret";
  if (step.status === "skipped") return "Sprunget over";
  return step.description;
}

function StepRow({
  step,
  act,
  onOpenPush,
  onNavigate
}: {
  step: GuideStepState;
  act: (action: GuideAction, stepId?: string) => Promise<boolean>;
  onOpenPush: () => void;
  onNavigate?: () => void;
}) {
  const meta = CAPABILITY_META[step.capability];
  const done = step.status === "done";
  const skipped = step.status === "skipped";

  const leading = (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
        done ? "bg-in/15 text-in" : skipped ? "bg-ink/[0.05] text-ink/35" : "bg-primary/12 text-moss"
      )}
    >
      <Icon name={done ? "check" : meta.icon} strokeWidth={done ? 2.6 : 1.9} />
    </span>
  );

  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cn("block font-semibold leading-snug", done || skipped ? "text-ink/55" : "text-ink")}>
          {step.title}
        </span>
        <span className={cn("mt-0.5 block text-sm leading-snug", done ? "text-in" : "text-ink/55")}>
          {statusText(step)}
        </span>
      </span>
    </>
  );

  const rowClass = "flex min-h-[4rem] min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left transition hover:bg-ink/[0.03] active:bg-ink/[0.06]";

  function open() {
    if (step.kind === "info") void act("seen", step.id);
    onNavigate?.();
  }

  return (
    <li className="flex items-stretch">
      {step.id === PUSH_STEP_ID ? (
        <button type="button" className={rowClass} onClick={onOpenPush}>
          {body}
        </button>
      ) : (
        <Link href={step.href} className={rowClass} onClick={open}>
          {body}
        </Link>
      )}
      {step.status === "todo" ? (
        <button
          type="button"
          onClick={() => void act("skip", step.id)}
          aria-label={`Spring over: ${step.title}`}
          title="Spring over"
          className="flex w-12 shrink-0 items-center justify-center text-ink/35 transition hover:text-ink/70"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      ) : skipped ? (
        <button
          type="button"
          onClick={() => void act("reset", step.id)}
          className="shrink-0 px-4 text-sm font-semibold text-moss hover:underline"
        >
          Fortryd
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
    </li>
  );
}

/** Guidens trin. `grouped` deler dem op efter del af appen (bøder, begivenheder osv.). */
export default function GuideStepList({
  steps,
  act,
  grouped,
  onNavigate
}: {
  steps: GuideStepState[];
  act: (action: GuideAction, stepId?: string) => Promise<boolean>;
  grouped?: boolean;
  onNavigate?: () => void;
}) {
  const [pushOpen, setPushOpen] = useState(false);
  const row = (step: GuideStepState) => (
    <StepRow key={step.id} step={step} act={act} onOpenPush={() => setPushOpen(true)} onNavigate={onNavigate} />
  );

  const groups = grouped
    ? capabilities
        .map((capability) => ({ capability, steps: steps.filter((s) => s.capability === capability) }))
        .filter((group) => group.steps.length > 0)
    : [];

  return (
    <>
      {grouped ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.capability}>
              <p className="px-4 pb-1 text-xs font-bold uppercase tracking-[0.14em] text-ink/45">
                {CAPABILITY_META[group.capability].label}
              </p>
              <ul className="divide-y divide-line">{group.steps.map(row)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line">{steps.map(row)}</ul>
      )}
      <SetupGuideSheet
        open={pushOpen}
        onClose={() => {
          setPushOpen(false);
          refreshGuide();
        }}
      />
    </>
  );
}
