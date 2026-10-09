"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Blokér lukning (fx mens der gemmes). */
  dismissible?: boolean;
  className?: string;
};

/**
 * Bundark på mobil, centreret dialog fra sm og op.
 * Esc lukker, baggrunden er scroll-låst, og fokus holdes i arket.
 */
export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  className
}: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const dragStart = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input, textarea, select, button:not([data-sheet-close])"
      );
      (first ?? panelRef.current)?.focus({ preventScroll: true });
    }, 30);

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissible) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, dismissible, onClose]);

  useEffect(() => {
    if (!open) setDragOffset(0);
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div
        className="absolute inset-0 animate-fade-in bg-[color:var(--scrim)] backdrop-blur-[2px]"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-surface shadow-[var(--shadow-lg)] outline-none",
          "animate-sheet-up sm:max-w-lg sm:animate-pop-in sm:rounded-[1.75rem]",
          className
        )}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 sm:hidden"
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return;
            setDragOffset(Math.max(0, event.clientY - dragStart.current));
          }}
          onPointerUp={() => {
            if (dragOffset > 90 && dismissible) onClose();
            dragStart.current = null;
            setDragOffset(0);
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-ink/20" />
        </div>
        {title || dismissible ? (
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-2 sm:pt-5">
            <div className="min-w-0">
              {title ? (
                <h2 id={titleId} className="font-display text-2xl font-bold uppercase leading-tight text-ink">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="mt-1 text-sm text-ink/60">{description}</p> : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                data-sheet-close
                onClick={onClose}
                aria-label="Luk"
                className="-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink/70 transition hover:bg-ink/10 active:scale-95"
              >
                <Icon name="x" className="h-[18px] w-[18px]" />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
            {footer}
          </div>
        ) : (
          <div className="h-[env(safe-area-inset-bottom,0px)] shrink-0" />
        )}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Fortryd",
  tone = "danger",
  loading
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} description={description} dismissible={!loading}>
      <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
        <Button
          block
          size="lg"
          loading={loading}
          variant={tone === "danger" ? "primary" : "primary"}
          className={tone === "danger" ? "bg-danger text-on-solid shadow-none" : undefined}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button block size="lg" variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  );
}
