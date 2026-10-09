"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type MotmRevealRow = {
  rank: number;
  userId: string;
  name: string;
  votes: number;
};

type Props = {
  open: boolean;
  eventTitle: string;
  revealRows: MotmRevealRow[];
  scoreboard: MotmRevealRow[];
  winner: MotmRevealRow | null;
  onClose: () => void;
};

/** Pause på intro-skærmen før første plads vises */
const INTRO_MS = 3200;
/** Tid mellem hver plads i countdown (højere = mere suspense) */
const COUNTDOWN_STEP_MS = 4800;
/** Pause på vinderkortet før hele listen vises */
const WINNER_HOLD_MS = 5500;

export function MotmRevealOverlay({ open, eventTitle, revealRows, scoreboard, winner, onClose }: Props) {
  /** Afslør fra bunden op; spring 1. plads over — vinder vises med "Vinderen er". */
  const countdownRows = useMemo(
    () => [...revealRows].filter((row) => row.rank !== 1).reverse(),
    [revealRows],
  );
  const [step, setStep] = useState(0);
  const [showFullResults, setShowFullResults] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setShowFullResults(false);
      return;
    }

    setStep(0);
    setShowFullResults(false);

    const timers: number[] = [];
    const schedule = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    if (scoreboard.length === 0) {
      return () => timers.forEach((id) => window.clearTimeout(id));
    }

    const L = countdownRows.length;

    if (L === 0) {
      setStep(0);
      schedule(INTRO_MS, () => setStep(1));
      schedule(INTRO_MS + WINNER_HOLD_MS, () => setShowFullResults(true));
      return () => timers.forEach((id) => window.clearTimeout(id));
    }

    for (let k = 1; k <= L; k++) {
      schedule(INTRO_MS + (k - 1) * COUNTDOWN_STEP_MS, () => setStep(k));
    }

    const winnerAt = INTRO_MS + L * COUNTDOWN_STEP_MS;
    schedule(winnerAt, () => setStep(L + 1));
    schedule(winnerAt + WINNER_HOLD_MS, () => setShowFullResults(true));

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [open, countdownRows, scoreboard.length]);

  if (!open) return null;

  const activeCountdownRow = step > 0 && step <= countdownRows.length ? countdownRows[step - 1] : null;
  const winnerVisible = countdownRows.length === 0 ? step >= 1 : step > countdownRows.length;

  const stage = activeCountdownRow ? `rank-${activeCountdownRow.userId}` : winnerVisible ? "winner" : "intro";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="Kampens spiller">
    <div className="hero-surface flex h-full flex-col overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-primary/70">Kampens spiller</p>
          <p className="truncate font-display text-xl font-bold uppercase">{eventTitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 shrink-0 rounded-full bg-on-primary/15 px-4 text-sm font-semibold transition hover:bg-on-primary/25 active:scale-95"
        >
          {showFullResults || scoreboard.length === 0 ? "Luk" : "Spring over"}
        </button>
      </div>

      {scoreboard.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-display text-5xl font-extrabold uppercase">Ingen stemmer</p>
          <p className="mt-2 text-on-primary/80">Afstemningen blev lukket uden nogen stemmer.</p>
        </div>
      ) : showFullResults ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          {winner ? (
            <div className="mb-6 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-on-primary/70">Vinderen</p>
              <p className="font-display text-6xl font-extrabold uppercase leading-none">{winner.name}</p>
              <p className="mt-1 text-on-primary/80">{winner.votes} {winner.votes === 1 ? "stemme" : "stemmer"} 🏆</p>
            </div>
          ) : null}
          <ol className="space-y-1.5">
            {scoreboard.map((row) => (
              <li
                key={row.userId}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${row.rank === 1 ? "bg-on-primary text-[color:var(--primary)]" : "bg-on-primary/10"}`}
              >
                <span className="tabular w-7 text-center font-display text-2xl font-bold">{row.rank}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span>
                <span className="tabular font-display text-xl font-bold">{row.votes}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div key={stage} className="flex flex-1 animate-pop-in flex-col items-center justify-center text-center">
          {activeCountdownRow ? (
            <>
              <p className="font-display text-[5.5rem] font-extrabold leading-none text-on-primary/35">
                {activeCountdownRow.rank}.
              </p>
              <p className="mt-2 font-display text-5xl font-extrabold uppercase leading-none">{activeCountdownRow.name}</p>
              <p className="mt-3 text-lg text-on-primary/80">{activeCountdownRow.votes} {activeCountdownRow.votes === 1 ? "stemme" : "stemmer"}</p>
            </>
          ) : winnerVisible && winner ? (
            <>
              <span className="mb-4 text-7xl" aria-hidden>
                🏆
              </span>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-on-primary/75">Vinderen er</p>
              <p className="mt-2 font-display text-6xl font-extrabold uppercase leading-none">{winner.name}</p>
              <p className="mt-3 text-lg text-on-primary/80">{winner.votes} {winner.votes === 1 ? "stemme" : "stemmer"}</p>
            </>
          ) : (
            <>
              <span className="mb-4 h-14 w-14 animate-spin rounded-full border-4 border-on-primary/25 border-t-on-primary" />
              <p className="font-display text-4xl font-extrabold uppercase">Gør jer klar…</p>
              <p className="mt-2 text-on-primary/75">Afsløringen starter om et øjeblik</p>
            </>
          )}
        </div>
      )}
    </div>
    </div>,
    document.body
  );
}
