"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Card, Chip, EmptyState, Field, ListGroup, PageHeader, Section, Skeleton, inputClass } from "@/components/ui/primitives";

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

type Tone = "neutral" | "in" | "out" | "pending";

function statusMeta(absence: AbsenceItem): { label: string; tone: Tone } {
  if (absence.status === "PENDING") return { label: "Afventer", tone: "pending" };
  if (absence.status === "REJECTED") return { label: "Afvist", tone: "out" };
  if (absence.status === "CANCELED") return { label: "Trukket tilbage", tone: "neutral" };
  if (absence.endedAt) return { label: "Stoppet", tone: "neutral" };
  if (new Date(absence.endDate) < new Date()) return { label: "Afsluttet", tone: "neutral" };
  if (new Date(absence.startDate) > new Date()) return { label: "Starter senere", tone: "in" };
  return { label: "Aktivt", tone: "in" };
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
    window.dispatchEvent(new Event("nav:refresh"));
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
      <EmptyState icon="users" title="Vælg et hold" description="Du skal være på et hold for at melde fravær." />
    );
  }

  return (
    <div className="space-y-7 pb-8 pt-1">
      <Link
        href="/dashboard/profil"
        className="inline-flex min-h-10 items-center gap-1 rounded-full pr-3 text-sm font-semibold text-ink/65 hover:text-ink"
      >
        <Icon name="chevron-left" className="h-5 w-5" />
        Profil
      </Link>
      <PageHeader
        title="Skade og fravær"
        subtitle="Meld dig fra over længere tid. Når fraværet er godkendt, bliver du automatisk meldt fra alle begivenheder i perioden."
      />

      <Section title="Meld fravær">
        <Card>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fra" htmlFor="absence-start">
                <input id="absence-start" type="date" className={inputClass} value={startDate} required
                  onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Til (forventet)" htmlFor="absence-end">
                <input id="absence-end" type="date" className={inputClass} value={endDate} required min={startDate}
                  onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Årsag" htmlFor="absence-reason" hint="Du kan til enhver tid stoppe fraværet og melde dig til igen.">
              <input id="absence-reason" className={inputClass} value={reason} required minLength={2} maxLength={200}
                placeholder="Fx skadet knæ eller udlandsophold" onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button type="submit" block icon="check" loading={submitting}>
              Send anmodning
            </Button>
          </form>
        </Card>
      </Section>

      {canManage && pending.length > 0 ? (
        <Section title={`Afventer godkendelse (${pending.length})`}>
          <ListGroup>
            {pending.map((a) => (
              <div key={a.id} className="space-y-3 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={a.user.name} image={null} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{a.user.name ?? "Ukendt"}</p>
                    <p className="text-sm text-ink/60">
                      {formatDate(a.startDate)} – {formatDate(a.endDate)}
                    </p>
                    <p className="text-sm text-ink/60">{a.reason}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="success" icon="check" loading={busyId === a.id}
                    onClick={() => act(a.id, `/api/absences/${a.id}/decision`, { decision: "APPROVE" }, "Fravær godkendt")}>
                    Godkend
                  </Button>
                  <Button variant="danger" icon="x" loading={busyId === a.id}
                    onClick={() => act(a.id, `/api/absences/${a.id}/decision`, { decision: "REJECT" }, "Fravær afvist")}>
                    Afvis
                  </Button>
                </div>
              </div>
            ))}
          </ListGroup>
        </Section>
      ) : null}

      <Section title="Dit fravær">
        {loading ? (
          <Skeleton className="h-24 rounded-[1.375rem]" />
        ) : mine.length === 0 ? (
          <Card>
            <p className="text-sm text-ink/60">Du har ikke noget fravær registreret.</p>
          </Card>
        ) : (
          <ListGroup>
            {mine.map((a) => {
              const meta = statusMeta(a);
              return (
                <div key={a.id} className="space-y-3 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {formatDate(a.startDate)} – {formatDate(a.endDate)}
                      </p>
                      <p className="text-sm text-ink/60">{a.reason}</p>
                    </div>
                    <Chip tone={meta.tone}>{meta.label}</Chip>
                  </div>
                  {isCurrent(a) ? (
                    <Button variant="secondary" size="sm" loading={busyId === a.id}
                      onClick={() =>
                        act(a.id, `/api/absences/${a.id}/stop`, {},
                          a.status === "PENDING" ? "Anmodning trukket tilbage" : "Fravær stoppet – du kan igen tilmelde dig")}>
                      {a.status === "PENDING" ? "Træk anmodning tilbage" : "Stop fravær – jeg er tilbage"}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </ListGroup>
        )}
      </Section>

      {canManage && othersCurrent.length > 0 ? (
        <Section title="Fraværende på holdet">
          <ListGroup>
            {othersCurrent.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={a.user.name} image={null} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{a.user.name ?? "Ukendt"}</p>
                  <p className="truncate text-sm text-ink/60">
                    {formatDate(a.startDate)} – {formatDate(a.endDate)} · {a.reason}
                  </p>
                </div>
              </div>
            ))}
          </ListGroup>
        </Section>
      ) : null}
    </div>
  );
}
