"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import type { DashboardTeamMember } from "@/components/DashboardTeamProvider";
import { MotmRevealOverlay, type MotmRevealRow } from "@/components/MotmRevealOverlay";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { Card, Chip, Section, Skeleton, Stepper } from "@/components/ui/primitives";
import { sumVotes } from "@/lib/events/eventUtils";

type ScoreRow = MotmRevealRow & { image?: string | null };

type MotmPoll = {
  id: string;
  status: "OPEN" | "CLOSED";
  votesPerVoter: number;
  revealCount: number;
  totalBallots: number;
  canManage: boolean;
  isCreator: boolean;
  myVotes: Array<{ userId: string; weight: number }>;
  voters: Array<{ userId: string; name: string; createdAt: string }> | null;
  scoreboard: ScoreRow[];
  revealRows: ScoreRow[];
  winner: ScoreRow | null;
};

type RevealState = {
  eventTitle: string;
  revealRows: MotmRevealRow[];
  scoreboard: MotmRevealRow[];
  winner: MotmRevealRow | null;
};

const strip = (row: ScoreRow): MotmRevealRow => ({ rank: row.rank, userId: row.userId, name: row.name, votes: row.votes });

function revealFrom(poll: MotmPoll, eventTitle: string): RevealState {
  return {
    eventTitle,
    revealRows: poll.revealRows.map(strip),
    scoreboard: poll.scoreboard.map(strip),
    winner: poll.winner ? strip(poll.winner) : null
  };
}

export default function MotmSection({
  eventId,
  eventTitle,
  members,
  canManage,
  userId,
  comingUserIds,
  onWinnerChange
}: {
  eventId: string;
  eventTitle: string;
  members: DashboardTeamMember[];
  canManage: boolean;
  userId: string;
  comingUserIds?: string[];
  onWinnerChange?: () => void;
}) {
  const { pushToast } = useToast();
  const [poll, setPoll] = useState<MotmPoll | null | undefined>(undefined);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<"open" | "vote" | "close" | "reset" | null>(null);
  const [votesPerVoter, setVotesPerVoter] = useState(3);
  const [revealCount, setRevealCount] = useState(5);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [confirm, setConfirm] = useState<"close-empty" | "reset" | null>(null);
  const [showEveryone, setShowEveryone] = useState(false);
  const lastStatus = useRef<string | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  const showReveal = useCallback((state: RevealState) => {
    setReveal(state);
    try {
      channel.current?.postMessage(state);
    } catch {
      /* ignore */
    }
  }, []);

  const apply = useCallback(
    (next: MotmPoll | null, options?: { syncDraft?: boolean }) => {
      setPoll(next);
      if (next && options?.syncDraft) {
        setDraft(Object.fromEntries(next.myVotes.map((vote) => [vote.userId, vote.weight])));
      }
      if (next && lastStatus.current === "OPEN" && next.status === "CLOSED") {
        showReveal(revealFrom(next, eventTitle));
        onWinnerChange?.();
      }
      lastStatus.current = next?.status ?? null;
    },
    [eventTitle, onWinnerChange, showReveal]
  );

  const load = useCallback(
    async (syncDraft = false) => {
      const response = await fetch(`/api/events/${eventId}/motm-poll`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPoll(null);
        return;
      }
      apply(data.poll ?? null, { syncDraft });
    },
    [eventId, apply]
  );

  useEffect(() => {
    lastStatus.current = null;
    setPoll(undefined);
    load(true);
  }, [load]);

  // Live-opdatering mens afstemningen er åben.
  useEffect(() => {
    if (poll?.status !== "OPEN") return;
    const timer = window.setInterval(() => void load(false), 3000);
    return () => window.clearInterval(timer);
  }, [poll?.status, load]);

  // Del afsløringen med andre faner i samme browser.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel("holdbold-motm");
    channel.current = bc;
    bc.onmessage = (message) => {
      if (message.data) setReveal(message.data as RevealState);
    };
    return () => {
      bc.close();
      channel.current = null;
    };
  }, []);

  async function call(method: "POST" | "DELETE", path: string, body?: unknown) {
    const response = await fetch(`/api/events/${eventId}/motm-poll${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Noget gik galt");
    return data;
  }

  const total = sumVotes(draft);
  const remaining = poll ? poll.votesPerVoter - total : 0;
  const hasVoted = Boolean(poll?.myVotes.length);

  async function openPoll() {
    setBusy("open");
    try {
      const data = await call("POST", "", { votesPerVoter, revealCount });
      apply(data.poll ?? null, { syncDraft: true });
      pushToast("Afstemningen er åben 🗳️", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke åbne afstemningen", "error");
    } finally {
      setBusy(null);
    }
  }

  async function persistVote() {
    const selections = Object.entries(draft)
      .filter(([, weight]) => weight > 0)
      .map(([voteUserId, weight]) => ({ userId: voteUserId, weight }));
    const data = await call("POST", "/vote", { selections });
    apply(data.poll ?? null, { syncDraft: true });
    return data.poll as MotmPoll | null;
  }

  async function vote() {
    if (!poll) return;
    if (total !== poll.votesPerVoter) {
      pushToast(`Fordel præcis ${poll.votesPerVoter} stemmer`, "error");
      return;
    }
    setBusy("vote");
    try {
      await persistVote();
      pushToast("Stemme gemt", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke gemme stemmen", "error");
    } finally {
      setBusy(null);
    }
  }

  async function closePoll(force = false) {
    if (!poll) return;
    if (total > 0 && total !== poll.votesPerVoter) {
      pushToast("Fordel alle dine stemmer eller nulstil dem, før du lukker.", "error");
      return;
    }
    setBusy("close");
    try {
      let ballots = poll.totalBallots;
      if (total === poll.votesPerVoter) {
        const saved = await persistVote();
        ballots = saved?.totalBallots ?? ballots;
      }
      if (ballots === 0 && !force) {
        setConfirm("close-empty");
        return;
      }
      const data = await call("POST", "/close");
      apply(data.poll ?? null, { syncDraft: true });
      setConfirm(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke lukke afstemningen", "error");
    } finally {
      setBusy(null);
    }
  }

  async function resetPoll() {
    setBusy("reset");
    try {
      const data = await call("DELETE", "");
      apply(data.poll ?? null, { syncDraft: true });
      setDraft({});
      setConfirm(null);
      pushToast("Afstemningen er nulstillet", "success");
      onWinnerChange?.();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Kunne ikke nulstille", "error");
    } finally {
      setBusy(null);
    }
  }

  // Som standard stemmes der blandt dem, der var meldt til – resten kan foldes ud.
  const coming = new Set(comingUserIds ?? []);
  const allCandidates = members
    .filter((member) => member.status === "ACTIVE")
    .sort((a, b) => (a.user.name ?? "").localeCompare(b.user.name ?? "", "da"));
  const limitToComing = coming.size > 0 && !showEveryone;
  const candidates = limitToComing
    ? allCandidates.filter((member) => coming.has(member.user.id) || (draft[member.user.id] ?? 0) > 0)
    : allCandidates;

  return (
    <Section title="Kampens spiller">
      {poll === undefined ? (
        <Skeleton className="h-40 rounded-[1.375rem]" />
      ) : poll === null ? (
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-moss">
              <Icon name="trophy" />
            </span>
            <div>
              <p className="font-semibold text-ink">Hvem var dagens bedste?</p>
              <p className="text-sm text-ink/60">
                {canManage
                  ? "Åbn afstemningen, når kampen er slut. Alle på holdet kan stemme."
                  : "Afstemningen er ikke åbnet endnu."}
              </p>
            </div>
          </div>
          {canManage ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-ink/[0.04] p-3 text-center">
                  <p className="text-xs font-semibold text-ink/60">Stemmer pr. person</p>
                  <div className="mt-1 flex justify-center">
                    <Stepper size="sm" value={votesPerVoter} onChange={setVotesPerVoter} min={1} max={10} label="Stemmer pr. person" />
                  </div>
                </div>
                <div className="rounded-2xl bg-ink/[0.04] p-3 text-center">
                  <p className="text-xs font-semibold text-ink/60">Pladser i afsløringen</p>
                  <div className="mt-1 flex justify-center">
                    <Stepper size="sm" value={revealCount} onChange={setRevealCount} min={1} max={10} label="Pladser" />
                  </div>
                </div>
              </div>
              <Button block size="lg" icon="trophy" loading={busy === "open"} onClick={openPoll}>
                Start afstemning
              </Button>
            </>
          ) : null}
        </Card>
      ) : poll.status === "OPEN" ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Chip tone="in" icon="clock">Afstemning åben</Chip>
            <span className="text-sm font-semibold text-ink/60">
              {poll.totalBallots} har stemt{hasVoted ? " · inkl. dig" : ""}
            </span>
          </div>
          <div className="rounded-2xl bg-primary/10 px-4 py-3">
            <p className="font-display text-2xl font-bold uppercase leading-none text-ink">
              {remaining > 0 ? `${remaining} stemme${remaining === 1 ? "" : "r"} tilbage` : "Klar til at gemme"}
            </p>
            <p className="mt-1 text-sm text-ink/60">Fordel {poll.votesPerVoter} stemmer mellem dem, der gjorde det bedst.</p>
          </div>
          <ul className="divide-y divide-line">
            {candidates.map((member) => {
              const value = draft[member.user.id] ?? 0;
              return (
                <li key={member.user.id} className="flex min-h-[3.5rem] items-center gap-3 py-1.5">
                  <Avatar name={member.user.name} image={member.user.image} size="md" />
                  <span className={cn("min-w-0 flex-1 truncate font-semibold", value > 0 ? "text-ink" : "text-ink/75")}>
                    {member.user.name}
                    {member.user.id === userId ? <span className="ml-1 text-ink/40">(dig)</span> : null}
                  </span>
                  <Stepper
                    size="sm"
                    value={value}
                    canIncrement={remaining > 0}
                    onChange={(next) => setDraft((prev) => ({ ...prev, [member.user.id]: next }))}
                    label={member.user.name ?? "Spiller"}
                  />
                </li>
              );
            })}
          </ul>
          {coming.size > 0 ? (
            <button
              type="button"
              onClick={() => setShowEveryone((prev) => !prev)}
              className="flex min-h-10 w-full items-center justify-center gap-1 text-sm font-semibold text-moss"
            >
              {showEveryone ? "Vis kun dem, der var med" : `Vis alle ${allCandidates.length} på holdet`}
              <Icon name="chevron-down" className={cn("h-4 w-4 transition", showEveryone && "rotate-180")} />
            </button>
          ) : null}
          <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] -mx-4 space-y-2 border-t border-line bg-surface px-4 pt-3 sm:static sm:mx-0 sm:px-0 lg:bottom-0">
            <Button block size="lg" loading={busy === "vote"} disabled={remaining !== 0} onClick={vote}>
              {hasVoted ? "Opdatér min stemme" : "Afgiv stemme"}
            </Button>
            {poll.isCreator ? (
              <Button block variant="secondary" icon="trophy" loading={busy === "close"} onClick={() => closePoll(false)}>
                Luk og afslør vinderen
              </Button>
            ) : null}
            {poll.canManage ? (
              <Button block variant="ghost" size="sm" onClick={() => setConfirm("reset")}>
                Nulstil afstemning
              </Button>
            ) : null}
          </div>
          {poll.isCreator && poll.voters && poll.voters.length > 0 ? (
            <p className="text-xs text-ink/50">Har stemt: {poll.voters.map((voter) => voter.name).join(", ")}</p>
          ) : null}
        </Card>
      ) : (
        <Card className="space-y-4">
          {poll.winner ? (
            <div className="hero-surface flex items-center gap-4 rounded-2xl p-4">
              <span className="relative">
                <Avatar
                  name={poll.winner.name}
                  image={poll.winner.image ?? members.find((m) => m.user.id === poll.winner?.userId)?.user.image}
                  size="lg"
                  className="ring-2 ring-on-primary/40"
                />
                <span className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#facc15] text-[#422006]">
                  <Icon name="trophy" className="h-4 w-4" strokeWidth={2.4} />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider text-on-primary/75">Kampens spiller</span>
                <span className="block truncate font-display text-3xl font-extrabold uppercase leading-none">
                  {poll.winner.name}
                </span>
                <span className="text-sm text-on-primary/80">{poll.winner.votes} {poll.winner.votes === 1 ? "stemme" : "stemmer"}</span>
              </span>
            </div>
          ) : (
            <p className="text-sm text-ink/60">Afstemningen blev lukket uden stemmer.</p>
          )}
          {poll.scoreboard.length > 1 ? (
            <ol className="space-y-1">
              {poll.scoreboard.slice(1, poll.revealCount).map((row) => (
                <li key={row.userId} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                  <span className="tabular w-6 text-center font-display text-lg font-bold text-ink/45">{row.rank}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{row.name}</span>
                  <span className="tabular text-sm font-semibold text-ink/60">{row.votes}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button block variant="secondary" icon="star" onClick={() => setReveal(revealFrom(poll, eventTitle))}>
              Se afsløringen igen
            </Button>
            {poll.canManage ? (
              <Button block variant="ghost" onClick={() => setConfirm("reset")}>
                Nulstil
              </Button>
            ) : null}
          </div>
        </Card>
      )}

      <ConfirmSheet
        open={confirm === "close-empty"}
        onClose={() => setConfirm(null)}
        onConfirm={() => closePoll(true)}
        loading={busy === "close"}
        title="Ingen har stemt"
        description="Lukker du nu, registreres der ingen vinder."
        confirmLabel="Luk alligevel"
      />
      <ConfirmSheet
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        onConfirm={resetPoll}
        loading={busy === "reset"}
        title="Nulstil afstemningen?"
        description={
          poll?.status === "CLOSED"
            ? "Vinderen og alle stemmer slettes."
            : "Alle afgivne stemmer slettes."
        }
        confirmLabel="Nulstil"
      />

      <MotmRevealOverlay
        open={Boolean(reveal)}
        eventTitle={reveal?.eventTitle ?? eventTitle}
        revealRows={reveal?.revealRows ?? []}
        scoreboard={reveal?.scoreboard ?? []}
        winner={reveal?.winner ?? null}
        onClose={() => setReveal(null)}
      />
    </Section>
  );
}
