"use client";

import { useEffect, useMemo, useState } from "react";

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

  return (
    <div className="modal-backdrop z-[70]" onClick={onClose}>
      <div className="modal-panel max-w-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Kampens spiller</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{eventTitle}</h2>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Luk
          </button>
        </div>

        {scoreboard.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-ink/10 bg-ink/[0.04] px-5 py-10 text-center">
            <p className="text-lg font-semibold text-ink">Ingen stemmer afgivet</p>
            <p className="mt-2 text-sm text-ink/70">Afstemningen blev lukket uden nogen stemmer.</p>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-3xl border border-moss/15 bg-moss/[0.05] px-5 py-10 text-center">
              {activeCountdownRow ? (
                <>
                  <p className="text-sm font-medium text-ink/60">{activeCountdownRow.rank}. plads</p>
                  <p className="mt-3 text-3xl font-semibold text-ink">{activeCountdownRow.name}</p>
                  <p className="mt-2 text-sm text-ink/70">{activeCountdownRow.votes} stemmer</p>
                </>
              ) : winnerVisible && winner ? (
                <>
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-moss">Vinderen er</p>
                  <p className="mt-3 text-4xl font-semibold text-ink">{winner.name}</p>
                  <p className="mt-2 text-base text-ink/75">{winner.votes} stemmer</p>
                </>
              ) : (
                <p className="text-lg font-semibold text-ink">Gør klar til afsløringen...</p>
              )}
            </div>

            {showFullResults ? (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Resultat</p>
                <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-white/80">
                  <ul className="divide-y divide-ink/10">
                    {scoreboard.map((row) => (
                      <li key={row.userId} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="w-8 text-center font-semibold text-ink/55">{row.rank}</span>
                          <span className="font-medium text-ink">{row.name}</span>
                        </div>
                        <span className="rounded-full bg-ink/5 px-3 py-1 font-semibold text-ink">{row.votes}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
