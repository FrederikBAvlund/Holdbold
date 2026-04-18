"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardTeamMember } from "@/components/DashboardTeamProvider";

export type DutyWheelKind = "thing" | "beer";

export type DutyWheelSignup = {
  userId: string;
  status: string;
  user: { id: string; name: string | null };
};

export type DutyWheelNextEvent = {
  id: string;
  title: string;
  date: string;
  kind: string;
};

export type DutyWheelAppliedPayload = {
  targetEventId: string;
  field: "thingCarrierId" | "beerCarrierId";
  userId: string;
};

type WheelPerson = { userId: string; name: string };

/** Distinct fills — order matters for greedy assignment around the circle. */
const WHEEL_SEGMENT_FILLS = [
  "color-mix(in srgb, var(--color-moss) 42%, white)",
  "#fef9c3",
  "#e0e7ff",
  "#fce7f3",
  "#dcfce7"
];

function buildDefaultInSignups(signups: DutyWheelSignup[]): WheelPerson[] {
  const seen = new Set<string>();
  const out: WheelPerson[] = [];
  for (const s of signups) {
    if (s.status !== "IN" || seen.has(s.userId)) continue;
    seen.add(s.userId);
    out.push({ userId: s.userId, name: s.user.name ?? "Ukendt" });
  }
  return out;
}

function buildBeerDefault(
  signups: DutyWheelSignup[],
  beerPreviouslyUserIds: string[]
): WheelPerson[] {
  const exclude = new Set(beerPreviouslyUserIds);
  return buildDefaultInSignups(signups).filter((p) => !exclude.has(p.userId));
}

function memberNameById(members: DashboardTeamMember[], userId: string): string {
  const m = members.find((x) => x.user.id === userId);
  return m?.user.name ?? "Ukendt";
}

/** Neighbour-safe coloring on a cycle (incl. edge n-1 ↔ 0). */
function segmentFillIndices(n: number): number[] {
  if (n <= 0) return [];
  const k = WHEEL_SEGMENT_FILLS.length;
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    let c = i % k;
    if (i > 0 && c === idx[i - 1]) {
      c = (c + 1) % k;
      if (i > 0 && c === idx[i - 1]) c = (c + 1) % k;
    }
    idx.push(c);
  }
  if (n > 1 && idx[n - 1] === idx[0]) {
    let c = (idx[n - 1] + 1) % k;
    if (c === idx[n - 2]) c = (c + 1) % k;
    if (c === idx[0]) c = (c + 1) % k;
    idx[n - 1] = c;
  }
  return idx;
}

function wedgePath(cx: number, cy: number, R: number, startDeg: number, endDeg: number): string {
  const r0 = (startDeg * Math.PI) / 180;
  const r1 = (endDeg * Math.PI) / 180;
  const x0 = cx + R * Math.cos(r0);
  const y0 = cy + R * Math.sin(r0);
  const x1 = cx + R * Math.cos(r1);
  const y1 = cy + R * Math.sin(r1);
  const sweep = endDeg - startDeg;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

function truncateLabel(name: string, maxLen: number): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

/** Groft tegn-budget langs radius (SVG-enheder) så tekst ikke når yderkant. */
function radialLabelCharCap(
  R: number,
  rStart: number,
  fontSize: number,
  outerPad = 10
): number {
  const radialBudget = Math.max(0, R - rStart - outerPad);
  const emW = fontSize * 0.56;
  return Math.max(4, Math.floor(radialBudget / emW));
}

const SPIN_TURNS = 12;
const SPIN_DURATION_S = 11.5;
const SPIN_MS = Math.round(SPIN_DURATION_S * 1000) + 150;

type Props = {
  kind: DutyWheelKind;
  eventId: string;
  members: DashboardTeamMember[];
  signups: DutyWheelSignup[];
  beerPreviouslyUserIds: string[];
  nextEvent: DutyWheelNextEvent | null;
  onClose: () => void;
  onApplied: (payload: DutyWheelAppliedPayload) => void;
  showToast: (message: string, variant: "success" | "error") => void;
};

export function DutyWheelModal({
  kind,
  eventId,
  members,
  signups,
  beerPreviouslyUserIds,
  nextEvent,
  onClose,
  onApplied,
  showToast
}: Props) {
  const initialList = useMemo(() => {
    return kind === "beer"
      ? buildBeerDefault(signups, beerPreviouslyUserIds)
      : buildDefaultInSignups(signups);
  }, [kind, signups, beerPreviouslyUserIds]);

  const [wheelPeople, setWheelPeople] = useState<WheelPerson[]>(initialList);
  const [addUserId, setAddUserId] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<WheelPerson | null>(null);
  const [targetChoice, setTargetChoice] = useState<"current" | "next">("current");
  const [applying, setApplying] = useState(false);
  const rotationRef = useRef(0);
  const idleRafRef = useRef<number | null>(null);
  const idleLastRef = useRef<number | null>(null);

  useEffect(() => {
    if (spinning || wheelPeople.length === 0 || winner) {
      if (idleRafRef.current !== null) {
        cancelAnimationFrame(idleRafRef.current);
        idleRafRef.current = null;
      }
      idleLastRef.current = null;
      return;
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const IDLE_DEG_PER_SEC = 11;

    const frame = (now: number) => {
      if (idleLastRef.current === null) {
        idleLastRef.current = now;
        idleRafRef.current = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.1, (now - idleLastRef.current) / 1000);
      idleLastRef.current = now;

      setRotation((prev) => {
        const next = prev + IDLE_DEG_PER_SEC * dt;
        rotationRef.current = next;
        return next;
      });

      idleRafRef.current = requestAnimationFrame(frame);
    };

    idleRafRef.current = requestAnimationFrame(frame);

    return () => {
      if (idleRafRef.current !== null) {
        cancelAnimationFrame(idleRafRef.current);
        idleRafRef.current = null;
      }
      idleLastRef.current = null;
    };
  }, [spinning, wheelPeople.length, winner]);

  useEffect(() => {
    setWheelPeople(initialList);
    setWinner(null);
    setRotation(0);
    rotationRef.current = 0;
    setTargetChoice("current");
    setAddUserId("");
  }, [initialList, eventId, kind]);

  const idsOnWheel = useMemo(() => new Set(wheelPeople.map((p) => p.userId)), [wheelPeople]);

  const addableMembers = useMemo(
    () =>
      members
        .filter((m) => m.status === "ACTIVE" && !idsOnWheel.has(m.user.id))
        .map((m) => ({ userId: m.user.id, name: m.user.name ?? "Ukendt" })),
    [members, idsOnWheel]
  );

  const removeFromWheel = useCallback((userId: string) => {
    setWheelPeople((prev) => prev.filter((p) => p.userId !== userId));
    setWinner((w) => (w?.userId === userId ? null : w));
  }, []);

  const addToWheel = useCallback(() => {
    const id = addUserId.trim();
    if (!id) return;
    if (idsOnWheel.has(id)) return;
    setWheelPeople((prev) => [...prev, { userId: id, name: memberNameById(members, id) }]);
    setAddUserId("");
    setWinner(null);
  }, [addUserId, idsOnWheel, members]);

  const spin = useCallback(() => {
    if (spinning || wheelPeople.length === 0) return;
    const snapshot = [...wheelPeople];
    const n = snapshot.length;
    const idx = Math.floor(Math.random() * n);
    const segment = 360 / n;
    const frac = 0.18 + Math.random() * 0.64;
    const winnerAlignDeg = (idx + frac) * segment;
    const base = rotationRef.current;
    const mod = ((base + winnerAlignDeg) % 360 + 360) % 360;
    const align = mod === 0 ? 360 : 360 - mod;
    const nextRotation = base + SPIN_TURNS * 360 + align;

    setSpinning(true);
    setWinner(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setRotation(nextRotation);
        rotationRef.current = nextRotation;
      });
    });

    window.setTimeout(() => {
      setWinner(snapshot[idx] ?? null);
      setSpinning(false);
    }, SPIN_MS);
  }, [spinning, wheelPeople]);

  const resetWheel = useCallback(() => {
    if (spinning) return;
    setWinner(null);
  }, [spinning]);

  const field: "thingCarrierId" | "beerCarrierId" = kind === "thing" ? "thingCarrierId" : "beerCarrierId";

  const applyWinner = useCallback(async () => {
    if (!winner) {
      showToast("Træk først et lod", "error");
      return;
    }
    const targetEventId = targetChoice === "next" && nextEvent ? nextEvent.id : eventId;
    if (targetChoice === "next" && !nextEvent) {
      showToast("Der er ingen kommende begivenhed at tildele", "error");
      return;
    }

    setApplying(true);
    try {
      const body =
        field === "thingCarrierId"
          ? { thingCarrierId: winner.userId }
          : { beerCarrierId: winner.userId };
      const response = await fetch(`/api/events/${targetEventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(typeof data.error === "string" ? data.error : "Kunne ikke gemme", "error");
        return;
      }
      showToast(kind === "thing" ? "Tingene opdateret" : "Øl opdateret", "success");
      onApplied({ targetEventId, field, userId: winner.userId });
      onClose();
    } finally {
      setApplying(false);
    }
  }, [winner, targetChoice, nextEvent, eventId, field, kind, onApplied, onClose, showToast]);

  const n = wheelPeople.length;
  const segment = n > 0 ? 360 / n : 0;
  const fillIdx = useMemo(() => segmentFillIndices(n), [n]);
  const cx = 100;
  const cy = 100;
  const R = 98;
  const rLabelStart = 26;
  const maxLabelCharsSoft = n <= 2 ? 32 : n <= 4 ? 26 : n <= 8 ? 20 : n <= 12 ? 17 : 14;

  const title = kind === "thing" ? "Lodtrækning om tingene" : "Lodtrækning om øl";

  const spinTransition = spinning
    ? `transform ${SPIN_DURATION_S}s cubic-bezier(0.17, 0.67, 0.12, 0.99)`
    : "none";

  return (
    <div className="modal-backdrop z-[80]" onClick={onClose}>
      <div
        className="modal-panel max-h-[min(92vh,720px)] max-w-xl overflow-y-auto px-4 sm:px-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="duty-wheel-title"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="duty-wheel-title" className="text-lg font-semibold text-ink">
            {title}
          </h3>
          <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
            Luk
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-ink/70">På hjulet ({wheelPeople.length})</p>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-control border border-ink/10 bg-white/80 p-2 text-sm">
              {wheelPeople.length === 0 ? (
                <li className="text-ink/50">Ingen endnu — tilføj nedenfor.</li>
              ) : (
                wheelPeople.map((p) => (
                  <li key={p.userId} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 px-2 py-1 text-xs"
                      onClick={() => removeFromWheel(p.userId)}
                      disabled={spinning}
                    >
                      Fjern
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <label className="text-xs font-medium text-ink/70" htmlFor="duty-wheel-add">
              Tilføj fra holdet
            </label>
            <div className="mt-2 flex flex-col gap-2">
              <select
                id="duty-wheel-add"
                className="input"
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                disabled={spinning || addableMembers.length === 0}
              >
                <option value="">Vælg medlem…</option>
                {addableMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={addToWheel}
                disabled={!addUserId || spinning}
              >
                Tilføj
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-5 w-full max-w-[min(92vw,480px)] sm:max-w-[460px]">
          <div className="relative mx-auto w-full pt-4">
            <div
              className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2"
              role="img"
              aria-label="Markør — feltet under spidss vinder når hjulet stopper"
            >
              <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden focusable="false">
                <polygon
                  points="14,20 0,0 28,0"
                  fill="#0f172a"
                  stroke="#fff"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="relative aspect-square w-full">
              {winner ? (
                <div
                  className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-2 sm:p-3"
                  role="status"
                  aria-live="polite"
                  aria-relevant="additions text"
                >
                  <div className="w-[min(92%,26rem)] max-w-full rounded-2xl bg-ink/65 px-4 py-3 text-center shadow-lg ring-1 ring-white/30 backdrop-blur-sm sm:px-5 sm:py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90 sm:text-xs">
                      Vinder
                    </p>
                    <p className="mt-1.5 break-words text-2xl font-bold leading-snug text-white sm:text-3xl md:text-4xl">
                      {winner.name}
                    </p>
                  </div>
                </div>
              ) : null}
              <svg
                className="relative z-0 h-full w-full drop-shadow-md will-change-transform"
                viewBox="0 0 200 200"
                role="img"
                aria-label="Lodtrækningshjul"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinTransition
                }}
              >
              {n > 0 ? (
                <defs>
                  {wheelPeople.map((person, i) => {
                    const startDeg = -90 + i * segment;
                    const endDeg = -90 + (i + 1) * segment;
                    const clipR = R - 1.2;
                    return (
                      <clipPath id={`duty-wheel-clip-${i}`} key={person.userId}>
                        <path d={wedgePath(cx, cy, clipR, startDeg, endDeg)} />
                      </clipPath>
                    );
                  })}
                </defs>
              ) : null}
              <circle cx={cx} cy={cy} r={R} fill="#f1f5f9" />
              {n > 0
                ? wheelPeople.map((person, i) => {
                    const startDeg = -90 + i * segment;
                    const endDeg = -90 + (i + 1) * segment;
                    const midDeg = -90 + (i + 0.5) * segment;
                    const midRad = (midDeg * Math.PI) / 180;
                    const gx = cx + rLabelStart * Math.cos(midRad);
                    const gy = cy + rLabelStart * Math.sin(midRad);
                    const fi = fillIdx[i] ?? i % WHEEL_SEGMENT_FILLS.length;
                    const fill = WHEEL_SEGMENT_FILLS[fi];
                    const fontSize = n <= 4 ? 11 : n <= 8 ? 9 : 7.5;
                    const charCap = radialLabelCharCap(R, rLabelStart, fontSize);
                    const labelMax = Math.min(maxLabelCharsSoft, charCap);
                    return (
                      <g key={person.userId}>
                        <path
                          d={wedgePath(cx, cy, R, startDeg, endDeg)}
                          fill={fill}
                          stroke="#cbd5e1"
                          strokeWidth={0.65}
                        />
                        <g clipPath={`url(#duty-wheel-clip-${i})`} style={{ pointerEvents: "none" }}>
                          <g transform={`translate(${gx},${gy}) rotate(${midDeg})`}>
                            <text
                              x={0}
                              y={0}
                              textAnchor="start"
                              dominantBaseline="middle"
                              fill="#0f172a"
                              fillOpacity={0.9}
                              fontSize={fontSize}
                              fontWeight={600}
                              fontFamily="system-ui, sans-serif"
                            >
                              {truncateLabel(person.name, labelMax)}
                            </text>
                          </g>
                        </g>
                      </g>
                    );
                  })
                : null}
              </svg>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">
            {spinning ? "Hjulet snurrer" : ""}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            className="btn-primary min-h-[3.25rem] w-full px-8 py-3 text-base font-semibold sm:min-h-[3.5rem] sm:w-auto sm:px-12 sm:text-lg"
            onClick={winner ? resetWheel : spin}
            disabled={spinning || (!winner && wheelPeople.length === 0)}
          >
            {spinning ? "Snurrer…" : winner ? "Nulstil" : "Træk lod"}
          </button>
        </div>

        {winner ? (
          <div className="mt-5 space-y-3 border-t border-ink/10 pt-4">
            <p className="text-xs font-semibold text-ink/70">Tildel til</p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="duty-wheel-target"
                  checked={targetChoice === "current"}
                  onChange={() => setTargetChoice("current")}
                  disabled={applying}
                />
                Denne begivenhed
              </label>
              <label
                className={`flex items-center gap-2 text-sm ${
                  nextEvent ? "cursor-pointer" : "cursor-not-allowed text-ink/40"
                }`}
              >
                <input
                  type="radio"
                  name="duty-wheel-target"
                  checked={targetChoice === "next"}
                  onChange={() => setTargetChoice("next")}
                  disabled={!nextEvent || applying}
                />
                {nextEvent ? (
                  <span>
                    Næste: {nextEvent.title} (
                    {new Date(nextEvent.date).toLocaleString("da-DK", {
                      dateStyle: "short",
                      timeStyle: "short"
                    })}
                    )
                  </span>
                ) : (
                  <span>Ingen senere begivenhed</span>
                )}
              </label>
            </div>
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={() => void applyWinner()}
              disabled={applying}
            >
              {applying ? "Gemmer…" : "Anvend"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
