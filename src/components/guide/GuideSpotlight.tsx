"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import Icon from "@/components/ui/Icon";
import type { GuideStepState } from "@/lib/guide/state";
import { placeTooltip, type Box, type TooltipPlacement } from "@/lib/guide/spotlightPlacement";
import { CAPABILITY_META } from "@/components/guide/guideMeta";
import { refreshGuide, stopSpotlight, useGuide, useSpotlight } from "@/components/guide/guideClient";

/** Hvor tit vi kigger efter ankeret – siderne henter data, så det dukker først op lidt efter */
const TICK_MS = 300;
/** Findes hverken anker eller indgang efter så lang tid, forklares trinet uden markering */
const MISSING_AFTER_MS = 2500;
const DONE_MS = 2200;
const PAD = 6;
/** Bundmenuen på mobil */
const NAV_RESERVED = 104;

type Found = { mode: "target" | "entry"; box: Box; el: Element } | { mode: "missing" } | null;

function sameFound(a: Found, b: Found) {
  if (a === null || b === null || a.mode === "missing" || b.mode === "missing") return a?.mode === b?.mode;
  return (
    a.mode === b.mode &&
    a.el === b.el &&
    a.box.top === b.box.top &&
    a.box.left === b.box.left &&
    a.box.width === b.box.width &&
    a.box.height === b.box.height
  );
}

function visibleBox(el: Element): Box | null {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function findAnchor(anchor: string): { el: Element; box: Box } | null {
  for (const el of Array.from(document.querySelectorAll(`[data-guide~="${anchor}"]`))) {
    const box = visibleBox(el);
    if (box) return { el, box };
  }
  return null;
}

/** Et ark eller en dialog dækker siden – så holder spotlightet sig væk */
function modalOpen() {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

/**
 * Peger på det rigtige sted i appen for det trin, brugeren valgte i guiden.
 * Markeringen fanger ikke tryk, så brugeren kan gøre tingen med det samme – og så krydser guiden af.
 */
export default function GuideSpotlight() {
  const { teamId } = useDashboardTeam();
  const { state, act } = useGuide(teamId);
  const stepId = useSpotlight();
  const pathname = usePathname();
  const [found, setFound] = useState<Found>(null);
  const [hidden, setHidden] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(160);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  const step: GuideStepState | undefined = stepId ? state?.steps.find((s) => s.id === stepId) : undefined;

  // Et trin, der ikke (længere) hører til brugeren, eller som allerede er klaret, når det startes
  useEffect(() => {
    if (!stepId || !state) return;
    if (!step) stopSpotlight();
  }, [stepId, state, step]);

  // Find ankeret – og bliv ved, så markeringen følger med, når siden scroller eller ændrer sig
  useEffect(() => {
    if (!step) {
      setFound(null);
      return;
    }
    const startedAt = Date.now();
    let wasModal = false;
    scrolledFor.current = null;

    function tick() {
      if (!step) return;
      const modal = modalOpen();
      // Når et ark lukkes, er der ofte netop sket noget (fx en bøde er givet)
      if (wasModal && !modal) refreshGuide();
      wasModal = modal;
      setHidden(modal);
      setViewport((prev) =>
        prev.width === window.innerWidth && prev.height === window.innerHeight
          ? prev
          : { width: window.innerWidth, height: window.innerHeight }
      );

      const target = step.anchor ? findAnchor(step.anchor) : null;
      const entry = !target && step.entry ? findAnchor(step.entry.anchor) : null;
      const hit = target ? { mode: "target" as const, ...target } : entry ? { mode: "entry" as const, ...entry } : null;
      if (hit) {
        const key = `${step.id}:${hit.mode}:${pathname}`;
        if (scrolledFor.current !== key) {
          scrolledFor.current = key;
          hit.el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setFound((prev) => (sameFound(prev, hit) ? prev : hit));
      } else if (Date.now() - startedAt > MISSING_AFTER_MS) {
        setFound((prev) => (prev?.mode === "missing" ? prev : { mode: "missing" }));
      }
    }

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, [step?.id, step?.anchor, step?.entry, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Har brugeren lige gjort det, guiden pegede på? Kig efter, når der trykkes inde i markeringen.
  const foundEl = found && found.mode !== "missing" ? found.el : null;
  useEffect(() => {
    if (!foundEl) return;
    // Gemning tager et øjeblik – kig både lidt efter og lidt senere
    const onClick = () => [1500, 4000].forEach((ms) => window.setTimeout(refreshGuide, ms));
    foundEl.addEventListener("click", onClick);
    return () => foundEl.removeEventListener("click", onClick);
  }, [foundEl]);

  // Klaret undervejs → lille fejring, og så er guiden af vejen
  useEffect(() => {
    if (!step || step.kind === "info" || step.status !== "done") return;
    setCelebrate(true);
    const timer = window.setTimeout(() => {
      setCelebrate(false);
      stopSpotlight();
    }, DONE_MS);
    return () => window.clearTimeout(timer);
  }, [step?.id, step?.status, step?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!step) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !modalOpen() && stopSpotlight();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  useLayoutEffect(() => {
    const height = tooltipRef.current?.offsetHeight;
    if (height && height !== tooltipHeight) setTooltipHeight(height);
  });

  if (!step || !found || hidden || typeof document === "undefined") return null;

  const meta = CAPABILITY_META[step.capability];
  const isEntry = found.mode === "entry";
  const box = found.mode === "missing" ? null : found.box;
  const placement: TooltipPlacement | null = box
    ? placeTooltip(box, viewport, tooltipHeight, viewport.width < 1024 ? NAV_RESERVED : 0)
    : null;

  async function understood() {
    if (!step) return;
    await act("seen", step.id);
    stopSpotlight();
  }

  async function skip() {
    if (!step) return;
    await act("skip", step.id);
    stopSpotlight();
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[85]" aria-live="polite">
      {box ? (
        <div
          className="absolute rounded-2xl ring-2 ring-primary transition-all duration-300 ease-out"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.5)"
          }}
        >
          {celebrate ? null : <div className="absolute -inset-1 animate-pulse rounded-[1.25rem] ring-4 ring-primary/40" />}
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/40" />
      )}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={step.title}
        className="pointer-events-auto absolute animate-pop-in rounded-[1.375rem] border border-line bg-surface p-4 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.45)]"
        style={
          placement
            ? { top: placement.top, bottom: placement.bottom, left: placement.left, width: placement.width }
            : { left: 16, right: 16, bottom: NAV_RESERVED + 16, maxWidth: 340, margin: "0 auto" }
        }
      >
        {celebrate ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-in/15 text-in">
              <Icon name="check" strokeWidth={2.6} />
            </span>
            <div>
              <p className="font-display text-xl font-bold uppercase leading-tight">Klaret! 🎉</p>
              <p className="text-sm text-ink/60">{step.title} er krydset af.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-moss">
                <Icon name={meta.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">{meta.label}</p>
                <p className="font-display text-xl font-bold uppercase leading-tight">{step.title}</p>
              </div>
              <button
                type="button"
                onClick={stopSpotlight}
                aria-label="Luk"
                className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/45 transition hover:bg-ink/[0.06] hover:text-ink"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-ink/70">{isEntry && step.entry ? step.entry.hint : step.description}</p>
            {found.mode === "missing" ? (
              <p className="mt-2 text-sm text-ink/50">Det ligger ikke på denne side lige nu – prøv igen, når der er noget at vise.</p>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              {/* Opgaver krydses af, når de er gjort – kun forklaringer skal bekræftes */}
              {step.kind === "info" && !isEntry ? (
                <button
                  type="button"
                  onClick={() => void understood()}
                  className="min-h-9 rounded-xl bg-primary px-3.5 text-sm font-semibold text-on-primary transition active:scale-95"
                >
                  Forstået
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void skip()}
                className="min-h-9 rounded-xl px-3 text-sm font-semibold text-ink/60 transition hover:bg-ink/[0.06] hover:text-ink"
              >
                Spring over
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
