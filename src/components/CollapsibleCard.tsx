"use client";

import { type ReactNode, useEffect, useState } from "react";

export function CollapsibleCard({
  title,
  description,
  /** Placeres i øverste højre hjørne til venstre for sammenklap-knappen (fx Log ud). */
  headerEnd,
  right,
  storageKey,
  defaultOpen = true,
  children,
  className = ""
}: {
  title: string;
  description?: string;
  headerEnd?: ReactNode;
  right?: ReactNode;
  storageKey?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const persist = Boolean(storageKey);
  const [open, setOpen] = useState(defaultOpen);
  const [ready, setReady] = useState(!persist);

  useEffect(() => {
    if (!persist || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey!);
    if (stored === "0") setOpen(false);
    if (stored === "1") setOpen(true);
    setReady(true);
  }, [persist, storageKey]);

  useEffect(() => {
    if (!persist || typeof window === "undefined" || !ready) return;
    window.localStorage.setItem(storageKey!, open ? "1" : "0");
  }, [open, persist, ready, storageKey]);

  return (
    <div className={`card relative w-full min-w-0 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          {description ? <p className="mt-2 text-sm text-ink/70">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {headerEnd}
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/20 bg-white/80 text-ink transition hover:border-ink/35 hover:bg-white"
            onClick={() => setOpen((prev) => !prev)}
            aria-label={open ? "Skjul kort" : "Vis kort"}
            title={open ? "Skjul" : "Vis"}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      {right ? <div className="mt-3">{right}</div> : null}
      {open ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
