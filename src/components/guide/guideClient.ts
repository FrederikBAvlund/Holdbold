"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { GuideState, GuideStepState } from "@/lib/guide/state";

export type GuideStepAction = "seen" | "done" | "skip" | "reset";
export type GuideAction = GuideStepAction | "start" | "dismiss" | "restart" | "acknowledge-role";

// Delt mellem alle komponenter, der viser guiden (forsiden, Profil), så de altid er enige.
const states = new Map<string, GuideState>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function load(teamId: string) {
  const running = inflight.get(teamId);
  if (running) return running;
  const promise = fetch(`/api/guide?teamId=${encodeURIComponent(teamId)}`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return;
      states.set(teamId, (await response.json()) as GuideState);
      emit();
    })
    .catch(() => undefined)
    .finally(() => inflight.delete(teamId));
  inflight.set(teamId, promise);
  return promise;
}

/** Hent guiden igen, fx efter brugeren har meldt til – så tjeklisten krydser af med det samme. */
export function refreshGuide() {
  states.forEach((_state, teamId) => void load(teamId));
}

const OPTIMISTIC_STATUS: Record<GuideStepAction, (step: GuideStepState) => GuideStepState> = {
  skip: (step) => (step.status === "todo" ? { ...step, status: "skipped" } : step),
  reset: (step) => (step.status === "skipped" ? { ...step, status: "todo" } : step),
  done: (step) => (step.status === "done" ? step : { ...step, status: "done", doneBy: "you" }),
  seen: (step) => (step.kind === "info" && step.status !== "done" ? { ...step, status: "done", doneBy: "you" } : step)
};

function withStep(state: GuideState, stepId: string, action: GuideStepAction): GuideState {
  const steps = state.steps.map((step) => (step.id === stepId ? OPTIMISTIC_STATUS[action](step) : step));
  const count = (status: GuideStepState["status"]) => steps.filter((s) => s.status === status).length;
  return { ...state, steps, summary: { total: steps.length, done: count("done"), skipped: count("skipped"), todo: count("todo") } };
}

export function useGuide(teamId: string) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  useEffect(() => {
    if (!teamId) return;
    void load(teamId);
    // Når man kommer tilbage til appen, kan noget være klaret i mellemtiden (fx push slået til)
    const onVisible = () => document.visibilityState === "visible" && void load(teamId);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [teamId]);

  const act = useCallback(
    async (action: GuideAction, stepId?: string) => {
      const current = states.get(teamId);
      if (current && stepId && action in OPTIMISTIC_STATUS) {
        states.set(teamId, withStep(current, stepId, action as GuideStepAction));
        emit();
      }
      try {
        const response = await fetch("/api/guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, action, ...(stepId ? { stepId } : {}) })
        });
        if (!response.ok) throw new Error("guide");
        states.set(teamId, (await response.json()) as GuideState);
        emit();
        return true;
      } catch {
        if (current) states.set(teamId, current);
        emit();
        return false;
      }
    },
    [teamId]
  );

  return { state: teamId ? states.get(teamId) ?? null : null, act };
}
