"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import LoadingButton from "@/components/LoadingButton";
import { useToast } from "@/components/ToastProvider";

type AbsenceItem = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  endedAt: string | null;
  user: { id: string; name: string | null };
  decidedBy: { id: string; name: string | null } | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

/** Dato fra <input type="date"> som lokal start/slut på dagen. */
function localDayBoundary(value: string, end: boolean) {
  const [y, m, d] = value.split("-").map(Number);
  return (end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0)).toISOString();
}

function todayInput() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function statusLabel(absence: AbsenceItem) {
  if (absence.status === "PENDING") return "Afventer godkendelse";
  if (absence.status === "REJECTED") return "Afvist";
  if (absence.status === "CANCELED") return "Trukket tilbage";
  if (absence.endedAt) return "Stoppet";
  if (new Date(absence.endDate) < new Date()) return "Afsluttet";
  if (new Date(absence.startDate) > new Date()) return "Godkendt – starter senere";
  return "Aktivt fravær";
}

export default function FravaerPage() {
  const { teamId, userId } = useDashboardTeam();
  const { pushToast } = useToast();
  const [absences, setAbsences] = useState<AbsenceItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(todayInput());
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    const response = await fetch(`/api/absences?teamId=${teamId}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setAbsences(data.absences ?? []);
      setCanManage(Boolean(data.canManage));
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(url: string, init: RequestInit, successMessage: string) {
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      pushToast(data.error ?? "Noget gik galt", "error");
      return false;
    }
    pushToast(successMessage, "success");
    await load();
    return true;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!endDate) {
      pushToast("Vælg en slutdato", "error");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await call(
        "/api/absences",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            startDate: localDayBoundary(startDate, false),
            endDate: localDayBoundary(endDate, true),
            reason
          })
        },
        "Fravær anmodet – afventer godkendelse"
      );
      if (ok) {
        setReason("");
        setEndDate("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function act(id: string, url: string, body: unknown, message: string) {
    setBusyId(id);
    try {
      await call(
        url,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) },
        message
      );
    } finally {
      setBusyId(null);
    }
  }

  const now = new Date();
  const pending = absences.filter((a) => a.status === "PENDING");
  const mine = absences.filter((a) => a.userId === userId);
  const isCurrent = (a: AbsenceItem) =>
    (a.status === "PENDING" || a.status === "APPROVED") && !a.endedAt && new Date(a.endDate) >= now;
  const othersCurrent = absences.filter((a) => a.userId !== userId && a.status === "APPROVED" && isCurrent(a));

  if (!teamId) {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Fravær</h2>
        <p className="mt-2 text-ink/70">Vælg aktivt hold i Indstillinger for at fortsætte.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="shrink-0 lg:hidden" aria-hidden style={{ height: "3.65rem" }} />
      <header className="card">
        <h2 className="text-2xl font-semibold text-ink">Skade og fravær</h2>
        <p className="mt-2 text-ink/70">
          Anmod om fravær over længere tid. Når bødekassen har godkendt det, meldes du automatisk fra alle
          begivenheder i perioden. Du kan til enhver tid stoppe fraværet – så nulstilles dine kommende
          begivenheder, og du kan melde dig til igen.
        </p>
      </header>

      <form className="card grid gap-3" onSubmit={submit}>
        <h3 className="text-lg font-semibold text-ink">Anmod om fravær</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="absence-start">Fra</label>
            <input id="absence-start" type="date" className="input" value={startDate} required
              onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="absence-end">Til (forventet)</label>
            <input id="absence-end" type="date" className="input" value={endDate} required min={startDate}
              onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="absence-reason">Årsag</label>
          <input id="absence-reason" className="input" value={reason} required minLength={2} maxLength={200}
            placeholder="Fx skadet knæ, udlandsophold" onChange={(e) => setReason(e.target.value)} />
        </div>
        <LoadingButton type="submit" className="btn-primary" isLoading={submitting}
          idleContent="Send anmodning" loadingContent="Sender..." />
      </form>

      {canManage && pending.length > 0 ? (
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-ink">Afventer godkendelse</h3>
          {pending.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 p-4">
              <div>
                <p className="font-semibold text-ink">{a.user.name ?? "Ukendt"}</p>
                <p className="text-sm text-ink/70">{formatDate(a.startDate)} – {formatDate(a.endDate)} · {a.reason}</p>
              </div>
              <div className="flex gap-2">
                <LoadingButton type="button" className="btn-primary" isLoading={busyId === a.id}
                  idleContent="Godkend" loadingContent="..."
                  onClick={() => act(a.id, `/api/absences/${a.id}/decision`, { decision: "APPROVE" }, "Fravær godkendt")} />
                <LoadingButton type="button" className="btn-ghost" isLoading={busyId === a.id}
                  idleContent="Afvis" loadingContent="..."
                  onClick={() => act(a.id, `/api/absences/${a.id}/decision`, { decision: "REJECT" }, "Fravær afvist")} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card space-y-3">
        <h3 className="text-lg font-semibold text-ink">Dit fravær</h3>
        {loading ? <p className="text-ink/70">Indlæser...</p> : null}
        {!loading && mine.length === 0 ? <p className="text-ink/70">Du har ikke noget fravær registreret.</p> : null}
        {mine.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 p-4">
            <div>
              <p className="font-semibold text-ink">{formatDate(a.startDate)} – {formatDate(a.endDate)}</p>
              <p className="text-sm text-ink/70">{a.reason} · {statusLabel(a)}</p>
            </div>
            {isCurrent(a) ? (
              <LoadingButton type="button" className="btn-ghost" isLoading={busyId === a.id}
                idleContent={a.status === "PENDING" ? "Træk anmodning tilbage" : "Stop fravær – jeg er tilbage"}
                loadingContent="..."
                onClick={() =>
                  act(a.id, `/api/absences/${a.id}/stop`, {},
                    a.status === "PENDING" ? "Anmodning trukket tilbage" : "Fravær stoppet – du kan igen tilmelde dig")}
              />
            ) : null}
          </div>
        ))}
      </div>

      {canManage && othersCurrent.length > 0 ? (
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-ink">Aktive fravær på holdet</h3>
          {othersCurrent.map((a) => (
            <div key={a.id} className="rounded-2xl border border-ink/10 bg-white/80 p-4">
              <p className="font-semibold text-ink">{a.user.name ?? "Ukendt"}</p>
              <p className="text-sm text-ink/70">{formatDate(a.startDate)} – {formatDate(a.endDate)} · {a.reason}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
