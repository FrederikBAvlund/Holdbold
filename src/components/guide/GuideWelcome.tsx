"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import Icon from "@/components/ui/Icon";
import { rolesLabel } from "@/lib/roleLabels";
import type { GuideState } from "@/lib/guide/state";
import { CAPABILITY_META } from "@/components/guide/guideMeta";

const SWIPE_PX = 50;

/** Fuldskærms-velkomst til nye medlemmer: hvem du er på holdet, hvad du kan, og så i gang. */
export default function GuideWelcome({
  state,
  teamName,
  onStart,
  onSkip,
  onLater
}: {
  state: GuideState;
  teamName: string;
  onStart: () => void;
  onSkip: () => void;
  /** Luk uden at vælge – velkomsten kommer igen næste gang */
  onLater: () => void;
}) {
  const [slide, setSlide] = useState(0);
  const [mounted, setMounted] = useState(false);
  const touchStart = useRef<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const role = rolesLabel(state.roles);
  const already = state.summary.done;

  const slides: { key: string; content: ReactNode }[] = [
    {
      key: "hello",
      content: (
        <>
          <span className="mb-5 text-7xl" aria-hidden>
            ⚽
          </span>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-on-primary/75">Velkommen til</p>
          <h2 className="mt-2 font-display text-5xl font-extrabold uppercase leading-[0.95]">
            {teamName || "holdet"}
          </h2>
          <p className="mt-4 inline-flex rounded-full bg-on-primary/15 px-4 py-1.5 text-sm font-semibold">Du er {role}</p>
          <p className="mt-5 max-w-xs text-lg text-on-primary/85">
            Holdbold samler kalender, tilmeldinger og bødekasse ét sted. Lad os vise dig rundt.
          </p>
        </>
      )
    },
    {
      key: "can",
      content: (
        <>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-on-primary/75">Som {role} kan du</p>
          <ul className="stagger mt-5 w-full max-w-sm space-y-2 text-left">
            {state.capabilities.map((capability) => {
              const meta = CAPABILITY_META[capability];
              return (
                <li key={capability} className="flex items-start gap-3 rounded-2xl bg-on-primary/10 px-4 py-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-on-primary/15">
                    <Icon name={meta.icon} />
                  </span>
                  <span>
                    <span className="block font-display text-lg font-bold uppercase leading-tight">{meta.label}</span>
                    <span className="block text-sm text-on-primary/80">{meta.pitch}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )
    },
    {
      key: "go",
      content: (
        <>
          <span className="mb-5 text-7xl" aria-hidden>
            🚀
          </span>
          <h2 className="font-display text-5xl font-extrabold uppercase leading-[0.95]">Klar?</h2>
          <p className="mt-4 max-w-xs text-lg text-on-primary/85">
            Vi har lavet en kort tjekliste med {state.summary.total} ting til dig.
            {already > 0 ? ` ${already} er allerede klaret – dem springer vi over.` : ""}
          </p>
        </>
      )
    }
  ];

  const last = slide === slides.length - 1;
  const go = (to: number) => setSlide(Math.max(0, Math.min(slides.length - 1, to)));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 30);
    return () => {
      document.body.style.overflow = overflow;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onLater();
      if (event.key === "ArrowRight") setSlide((s) => Math.min(slides.length - 1, s + 1));
      if (event.key === "ArrowLeft") setSlide((s) => Math.max(0, s - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLater, slides.length]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="Velkommen til Holdbold">
      <div
        className="hero-surface flex h-full flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))]"
        onTouchStart={(event) => (touchStart.current = event.touches[0]?.clientX ?? null)}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const end = event.changedTouches[0]?.clientX;
          touchStart.current = null;
          if (start === null || end === undefined) return;
          if (start - end > SWIPE_PX) go(slide + 1);
          if (end - start > SWIPE_PX) go(slide - 1);
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-label={`Side ${slide + 1} af ${slides.length}`}>
            {slides.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => go(index)}
                aria-label={`Gå til side ${index + 1}`}
                aria-current={index === slide ? "step" : undefined}
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === slide ? "w-6 bg-on-primary" : "w-2 bg-on-primary/35"
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onLater}
            className="min-h-10 shrink-0 rounded-full bg-on-primary/15 px-4 text-sm font-semibold transition hover:bg-on-primary/25 active:scale-95"
          >
            Senere
          </button>
        </div>

        <div
          key={slides[slide].key}
          className="mx-auto flex w-full max-w-md flex-1 animate-pop-in flex-col items-center justify-center overflow-y-auto py-8 text-center"
          aria-live="polite"
        >
          {slides[slide].content}
        </div>

        <div className="mx-auto w-full max-w-md space-y-2">
          {last ? (
            <>
              <button
                ref={nextRef}
                type="button"
                onClick={onStart}
                className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-on-primary text-base font-semibold text-[color:var(--primary)] transition active:scale-[0.98]"
              >
                Vis mig rundt <Icon name="arrow-right" />
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="min-h-11 w-full rounded-2xl text-sm font-semibold text-on-primary/80 transition hover:text-on-primary"
              >
                Spring guiden over
              </button>
            </>
          ) : (
            <button
              ref={nextRef}
              type="button"
              onClick={() => go(slide + 1)}
              className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-on-primary text-base font-semibold text-[color:var(--primary)] transition active:scale-[0.98]"
            >
              Næste <Icon name="arrow-right" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
