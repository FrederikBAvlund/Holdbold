"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import { rolesLabel } from "@/lib/roleLabels";
import type { GuidePromotion as Promotion } from "@/lib/guide/state";
import { CAPABILITY_META } from "@/components/guide/guideMeta";

/** Fuldskærm, når et medlem har fået en ny rolle: kun det nye – og kun det, holdet ikke allerede har sat op. */
export default function GuidePromotion({
  promotion,
  teamName,
  onShow,
  onLater
}: {
  promotion: Promotion;
  teamName: string;
  /** Spring direkte til det første nye trin */
  onShow: () => void;
  onLater: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const todo = promotion.stepIds.length;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), 30);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onLater();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onLater]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="Du har fået en ny rolle">
      <div className="hero-surface flex h-full flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))]">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onLater}
            className="min-h-10 shrink-0 rounded-full bg-on-primary/15 px-4 text-sm font-semibold transition hover:bg-on-primary/25 active:scale-95"
          >
            Ikke nu
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 animate-pop-in flex-col items-center justify-center overflow-y-auto py-6 text-center">
          <span className="mb-4 text-7xl" aria-hidden>
            🎉
          </span>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-on-primary/75">Du er blevet</p>
          <h2 className="mt-2 max-w-full break-words font-display text-[clamp(2rem,11vw,3rem)] font-extrabold uppercase leading-[0.95]">
            {rolesLabel(promotion.gainedRoles)}
          </h2>
          {teamName ? <p className="mt-3 text-on-primary/80">på {teamName}</p> : null}

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-on-primary/75">Nyt for dig</p>
          <ul className="stagger mt-3 w-full space-y-2 text-left">
            {promotion.capabilities.map((capability) => {
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

          <p className="mt-5 max-w-xs text-on-primary/85">
            {todo === 0
              ? "Holdet har allerede sat det hele op – du kan gå direkte i gang."
              : todo === 1
                ? "Der er 1 ting, vi gerne vil vise dig."
                : `Der er ${todo} ting, vi gerne vil vise dig. Det, holdet allerede har sat op, springer vi over.`}
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <button
            ref={primaryRef}
            type="button"
            onClick={todo > 0 ? onShow : onLater}
            className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-on-primary text-base font-semibold text-[color:var(--primary)] transition active:scale-[0.98]"
          >
            {todo > 0 ? (
              <>
                Vis mig det nye <Icon name="arrow-right" />
              </>
            ) : (
              "Fedt"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
