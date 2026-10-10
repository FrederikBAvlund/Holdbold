"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardTeamMember } from "@/components/DashboardTeamProvider";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { inputClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

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

/** Felter i hjulet: nuancer af temaets primærfarve, så hjulet følger resten af appen i lys og mørk. */
const WHEEL_SEGMENT_FILLS = [
  "color-mix(in srgb, var(--primary) 16%, var(--surface))",
  "color-mix(in srgb, var(--primary) 34%, var(--surface))",
  "color-mix(in srgb, var(--primary) 52%, var(--surface))"
];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "da");

function buildDefaultInSignups(signups: DutyWheelSignup[]): WheelPerson[] {
  const seen = new Set<string>();
  const out: WheelPerson[] = [];
  for (const s of signups) {
    if (s.status !== "IN" || seen.has(s.userId)) continue;
    seen.add(s.userId);
    out.push({ userId: s.userId, name: s.user.name ?? "Ukendt" });
  }
  return out.sort(byName);
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

/** Farver felterne, så naboer (også sidste og første) aldrig får samme farve. */
function segmentFillIndices(n: number): number[] {
  const k = WHEEL_SEGMENT_FILLS.length;
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    let c = i % k;
    const forbidden = new Set<number>();
    if (i > 0) forbidden.add(idx[i - 1]);
    if (i === n - 1 && n > 1) forbidden.add(idx[0]);
    while (forbidden.has(c)) c = (c + 1) % k;
    idx.push(c);
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
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [targetChoice, setTargetChoice] = useState<"current" | "next">("current");
  const [applying, setApplying] = useState(false);
  const rotationRef = useRef(0);

  useEffect(() => {
    setWheelPeople(initialList);
    setWinner(null);
    setWinnerIndex(null);
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
        .map((m) => ({ userId: m.user.id, name: m.user.name ?? "Ukendt" }))
        .sort(byName),
    [members, idsOnWheel]
  );

  const removeFromWheel = useCallback((userId: string) => {
    setWheelPeople((prev) => prev.filter((p) => p.userId !== userId));
    setWinner(null);
    setWinnerIndex(null);
  }, []);

  const addToWheel = useCallback(() => {
    const id = addUserId.trim();
    if (!id) return;
    if (idsOnWheel.has(id)) return;
    setWheelPeople((prev) => [...prev, { userId: id, name: memberNameById(members, id) }].sort(byName));
    setAddUserId("");
    setWinner(null);
    setWinnerIndex(null);
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
    setWinnerIndex(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setRotation(nextRotation);
        rotationRef.current = nextRotation;
      });
    });

    window.setTimeout(() => {
      setWinner(snapshot[idx] ?? null);
      setWinnerIndex(idx);
      setSpinning(false);
    }, SPIN_MS);
  }, [spinning, wheelPeople]);

  const resetWheel = useCallback(() => {
    if (spinning) return;
    setWinner(null);
    setWinnerIndex(null);
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
    <Sheet open onClose={onClose} title={title} dismissible={!applying && !spinning}>
      <div className="space-y-5">
        {/* Hjulet kan hverken trækkes eller markeres – det drejer kun, når man trækker lod. */}
        <div className="mx-auto w-full max-w-[min(86vw,22rem)] select-none">
          <div className="relative pt-5">
            <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 drop-shadow-md" aria-hidden>
              <svg width="30" height="26" viewBox="0 0 30 26" focusable="false">
                <path d="M15 26 L2 4 Q1 0 6 0 H24 Q29 0 28 4 Z" fill="var(--ink)" stroke="var(--surface)" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="relative aspect-square w-full rounded-full bg-surface p-2 shadow-[var(--shadow-md)] ring-1 ring-[color:var(--line)]">
              <svg
                className="pointer-events-none h-full w-full will-change-transform"
                viewBox="0 0 200 200"
                role="img"
                aria-label="Lodtrækningshjul"
                style={{ transform: `rotate(${rotation}deg)`, transition: spinTransition }}
              >
                {n === 0 ? (
                  <circle cx={cx} cy={cy} r={R} fill="var(--surface-2)" stroke="var(--line)" strokeWidth={1} />
                ) : n === 1 ? (
                  <circle cx={cx} cy={cy} r={R} fill={WHEEL_SEGMENT_FILLS[1]} stroke="var(--surface)" strokeWidth={1.2} />
                ) : (
                  wheelPeople.map((person, i) => (
                    <path
                      key={person.userId}
                      d={wedgePath(cx, cy, R, -90 + i * segment, -90 + (i + 1) * segment)}
                      fill={WHEEL_SEGMENT_FILLS[fillIdx[i] ?? 0]}
                      stroke="var(--surface)"
                      strokeWidth={1.2}
                      opacity={winnerIndex === null || winnerIndex === i ? 1 : 0.4}
                    />
                  ))
                )}
                {wheelPeople.map((person, i) => {
                  const midDeg = n === 1 ? -90 : -90 + (i + 0.5) * segment;
                  const midRad = (midDeg * Math.PI) / 180;
                  const gx = cx + rLabelStart * Math.cos(midRad);
                  const gy = cy + rLabelStart * Math.sin(midRad);
                  const fontSize = n <= 4 ? 11 : n <= 8 ? 9 : 7.5;
                  const labelMax = Math.min(maxLabelCharsSoft, radialLabelCharCap(R, rLabelStart, fontSize));
                  return (
                    <g
                      key={`label-${person.userId}`}
                      transform={`translate(${gx},${gy}) rotate(${midDeg})`}
                      opacity={winnerIndex === null || winnerIndex === i ? 1 : 0.5}
                    >
                      <text
                        x={0}
                        y={0}
                        textAnchor="start"
                        dominantBaseline="middle"
                        fill="var(--ink)"
                        fontSize={fontSize}
                        fontWeight={700}
                        fontFamily="inherit"
                      >
                        {truncateLabel(person.name, labelMax)}
                      </text>
                    </g>
                  );
                })}
                <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--primary)" strokeWidth={2.4} />
                <circle cx={cx} cy={cy} r={15} fill="var(--surface)" stroke="var(--primary)" strokeWidth={2.4} />
                <circle cx={cx} cy={cy} r={5} fill="var(--primary)" />
              </svg>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">
            {spinning ? "Hjulet snurrer" : winner ? `Vinder: ${winner.name}` : ""}
          </p>
        </div>

        {winner ? (
          <div
            className="animate-pop-in rounded-[1.375rem] bg-primary px-4 py-4 text-center text-on-primary"
            role="status"
            aria-live="polite"
          >
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.22em] opacity-80">Vinder</p>
            <p className="mt-1 break-words font-display text-4xl font-extrabold uppercase leading-none">{winner.name}</p>
          </div>
        ) : null}

        <Button
          size="lg"
          block
          variant={winner ? "secondary" : "primary"}
          onClick={winner ? resetWheel : spin}
          disabled={spinning || (!winner && wheelPeople.length === 0)}
        >
          {spinning ? "Snurrer…" : winner ? "Nulstil" : "Træk lod"}
        </Button>

        {winner ? (
          <div className="space-y-3 rounded-[1.375rem] border border-line p-4">
            <p className="text-sm font-semibold text-ink/80">Tildel til</p>
            <div className="space-y-2">
              <label className={cn(radioRow, targetChoice === "current" && "border-moss bg-moss/10")}>
                <input
                  type="radio"
                  name="duty-wheel-target"
                  className="h-4 w-4 accent-[var(--primary)]"
                  checked={targetChoice === "current"}
                  onChange={() => setTargetChoice("current")}
                  disabled={applying}
                />
                Denne begivenhed
              </label>
              <label
                className={cn(
                  radioRow,
                  targetChoice === "next" && nextEvent && "border-moss bg-moss/10",
                  !nextEvent && "cursor-not-allowed text-ink/40"
                )}
              >
                <input
                  type="radio"
                  name="duty-wheel-target"
                  className="h-4 w-4 accent-[var(--primary)]"
                  checked={targetChoice === "next"}
                  onChange={() => setTargetChoice("next")}
                  disabled={!nextEvent || applying}
                />
                {nextEvent ? (
                  <span>
                    Næste: {nextEvent.title} (
                    {new Date(nextEvent.date).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" })})
                  </span>
                ) : (
                  <span>Ingen senere begivenhed</span>
                )}
              </label>
            </div>
            <Button block icon="check" onClick={() => void applyWinner()} loading={applying}>
              Anvend
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink/80">På hjulet · {wheelPeople.length}</p>
          {wheelPeople.length === 0 ? (
            <p className="rounded-2xl bg-ink/[0.04] px-4 py-3 text-sm text-ink/55">Ingen endnu – tilføj nedenfor.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {wheelPeople.map((p) => (
                <li
                  key={p.userId}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full bg-ink/[0.06] py-1 pl-3.5 pr-1.5 text-sm font-semibold text-ink"
                >
                  <span className="max-w-[10rem] truncate">{p.name}</span>
                  <button
                    type="button"
                    aria-label={`Fjern ${p.name} fra hjulet`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/55 transition hover:bg-ink/10 hover:text-ink active:scale-95 disabled:opacity-40"
                    onClick={() => removeFromWheel(p.userId)}
                    disabled={spinning}
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-ink/80" htmlFor="duty-wheel-add">
            Tilføj fra holdet
          </label>
          <div className="flex gap-2">
            <select
              id="duty-wheel-add"
              className={cn(inputClass, "min-w-0 flex-1")}
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
            <Button onClick={addToWheel} disabled={!addUserId || spinning} icon="plus">
              Tilføj
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

const radioRow =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 text-sm font-medium text-ink transition";
