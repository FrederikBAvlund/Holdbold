"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredTeamId, getStoredUserId } from "@/components/appState";
import { Combobox } from "@/components/ui/combobox";

type FineTemplate = {
  id: string;
  title: string;
  amount: number;
  description?: string | null;
};

type Member = {
  role: string;
  user: {
    id: string;
    name: string;
    email?: string | null;
  };
};

type FineItem = {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  createdByLabel?: string | null;
  createdBy?: { name: string | null } | null;
  user?: { id: string; name: string | null } | null;
  template?: FineTemplate | null;
};

const fineRoles = ["BOEDEKASSEFORMAND", "ADMIN"];

export default function BoderPage() {
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<FineTemplate[]>([]);
  const [fines, setFines] = useState<FineItem[]>([]);
  const [teamFines, setTeamFines] = useState<FineItem[]>([]);

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateAmount, setTemplateAmount] = useState(20);
  const [templateDescription, setTemplateDescription] = useState("");

  const [fineUserId, setFineUserId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [fineAmount, setFineAmount] = useState(50);
  const [fineReason, setFineReason] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTeamId(getStoredTeamId());
    setUserId(getStoredUserId());
  }, []);

  const actingMember = members.find((member) => member.user.id === userId);
  const canManageFines = actingMember ? fineRoles.includes(actingMember.role) : false;

  useEffect(() => {
    async function loadMembers() {
      if (!teamId) return;
      const response = await fetch(`/api/team-members?teamId=${teamId}`);
      const data = await response.json();
      setMembers(data.members ?? []);
    }

    loadMembers();
  }, [teamId]);

  useEffect(() => {
    async function loadTemplates() {
      if (!teamId) return;
      const response = await fetch(`/api/fine-templates?teamId=${teamId}`);
      const data = await response.json();
      setTemplates(data.templates ?? []);
    }

    loadTemplates();
  }, [teamId]);

  useEffect(() => {
    async function loadFines() {
      if (!teamId || !userId) return;
      const response = await fetch(`/api/fines?teamId=${teamId}&userId=${userId}`);
      const data = await response.json();
      setFines(data.fines ?? []);
    }

    loadFines();
  }, [teamId, userId]);

  useEffect(() => {
    async function loadTeamFines() {
      if (!teamId) return;
      const response = await fetch(`/api/fines?teamId=${teamId}`);
      const data = await response.json();
      setTeamFines(data.fines ?? []);
    }

    loadTeamFines();
  }, [teamId]);

  const totalBoder = useMemo(() => fines.reduce((sum, fine) => sum + fine.amount, 0), [fines]);

  const rankedDebtors = useMemo(() => {
    const totals = new Map<string, { name: string; total: number }>();
    for (const fine of teamFines) {
      const user = fine.user;
      if (!user) continue;
      const current = totals.get(user.id) ?? { name: user.name ?? "Ukendt", total: 0 };
      current.total += fine.amount;
      totals.set(user.id, current);
    }
    return Array.from(totals.entries())
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => b.total - a.total);
  }, [teamFines]);

  async function handleCreateTemplate(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/fine-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        title: templateTitle,
        amount: Number(templateAmount),
        description: templateDescription || undefined,
        createdById: userId || undefined
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Kunne ikke oprette bødeskabelon");
      return;
    }

    setMessage("Bødeskabelon oprettet");
    setTemplateTitle("");
    setTemplateAmount(20);
    setTemplateDescription("");
    setTemplates((prev) => [data.template, ...prev]);
  }

  async function handleCreateFine(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const payload: Record<string, unknown> = {
      teamId,
      userId: fineUserId,
      createdById: userId || undefined
    };

    if (selectedTemplateId) {
      payload.templateId = selectedTemplateId;
    } else {
      payload.amount = Number(fineAmount);
      payload.reason = fineReason;
    }

    const response = await fetch("/api/fines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Kunne ikke oprette bøde");
      return;
    }

    setMessage(canManageFines ? "Bøde tildelt" : "Bøde foreslået");
    setShowAssignModal(false);
  }

  async function approveFine(id: string) {
    await fetch(`/api/fines/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedById: userId })
    });
    setTeamFines((prev) => prev.map((fine) => (fine.id === id ? { ...fine, status: "PAID_APPROVED" } : fine)));
  }

  async function rejectFine(id: string) {
    await fetch(`/api/fines/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectedById: userId })
    });
    setTeamFines((prev) => prev.map((fine) => (fine.id === id ? { ...fine, status: "AFVIST" } : fine)));
  }

  function creatorLabel(fine: FineItem) {
    return fine.createdBy?.name ?? fine.createdByLabel ?? "System";
  }

  const pendingFines = teamFines.filter((fine) => fine.status === "FORESLAET");
  const filteredMembers = members.filter((member) =>
    member.user.name?.toLowerCase().includes(search.toLowerCase())
  );
  const memberOptions = filteredMembers.map((member) => ({
    value: member.user.id,
    label: `${member.user.name} (${member.role})`
  }));
  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: `${template.title} (${template.amount} kr)`
  }));

  if (!teamId || !userId) {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Bøder</h2>
        <p className="mt-2 text-ink/70">
          Vælg aktivt team og bruger i Indstillinger for at fortsætte.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="card">
        <h2 className="text-2xl font-semibold text-ink">Bøder</h2>
        <p className="mt-2 text-ink/70">Overblik over bøder og skabeloner.</p>
        {message ? <p className="mt-3 text-sm text-ink/70">{message}</p> : null}
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <button className="btn-primary" onClick={() => setShowAssignModal(true)}>
          {canManageFines ? "Tildel bøde" : "Foreslå bøde"}
        </button>
        {canManageFines ? (
          <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">Bødekasseformand</span>
        ) : null}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">Mine bøder</h3>
            <p className="mt-1 text-sm text-ink/60">Overblik over dine egne bøder.</p>
          </div>
          <div className="rounded-full bg-ember/10 px-4 py-2 text-sm font-semibold text-ember">
            Total: {totalBoder} kr
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {fines.length === 0 ? (
            <p className="text-sm text-ink/60">Ingen bøder fundet.</p>
          ) : (
            fines.map((fine) => (
              <div key={fine.id} className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{fine.reason}</p>
                    <p className="text-xs text-ink/60">
                      {new Date(fine.createdAt).toLocaleDateString("da-DK")} · {creatorLabel(fine)}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-ink">{fine.amount} kr</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">Top skyldnere</h3>
            <p className="mt-1 text-sm text-ink/60">Samlet bødebeløb pr. spiller.</p>
          </div>
          <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/60">
            {rankedDebtors.length} spillere
          </span>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-left">
              <tr>
                <th className="px-4 py-3">Spiller</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rankedDebtors.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-ink/60" colSpan={2}>
                    Ingen bøder endnu.
                  </td>
                </tr>
              ) : (
                rankedDebtors.map((debtor) => (
                  <tr key={debtor.id} className="border-t border-ink/10">
                    <td className="px-4 py-3">{debtor.name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{debtor.total} kr</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canManageFines ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h3 className="text-lg font-semibold text-ink">Bødeskabeloner</h3>
            <p className="mt-2 text-sm text-ink/70">Genbrug skabeloner som “Mødt for sent” eller “Mangler afmelding”.</p>
            <form onSubmit={handleCreateTemplate} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="label" htmlFor="template-title">Titel</label>
                <input
                  id="template-title"
                  value={templateTitle}
                  onChange={(event) => setTemplateTitle(event.target.value)}
                  placeholder="Titel"
                  className="input"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="template-amount">Beløb</label>
                <input
                  id="template-amount"
                  type="number"
                  value={templateAmount}
                  onChange={(event) => setTemplateAmount(Number(event.target.value))}
                  placeholder="Beløb"
                  className="input"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="label" htmlFor="template-desc">Beskrivelse</label>
                <input
                  id="template-desc"
                  value={templateDescription}
                  onChange={(event) => setTemplateDescription(event.target.value)}
                  placeholder="Beskrivelse (valgfri)"
                  className="input"
                />
              </div>
              <button className="btn-primary sm:col-span-2">Opret skabelon</button>
            </form>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-ink">Foreslåede bøder</h3>
            <p className="mt-2 text-sm text-ink/70">Godkend eller afvis bøder foreslået af spillere.</p>
            <div className="mt-4 space-y-3">
              {pendingFines.length === 0 ? (
                <p className="text-sm text-ink/60">Ingen foreslåede bøder.</p>
              ) : (
                pendingFines.map((fine) => (
                  <div key={fine.id} className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{fine.reason}</p>
                        <p className="text-xs text-ink/60">
                          {fine.user?.name ?? "Ukendt"} · {creatorLabel(fine)}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-ink">{fine.amount} kr</div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="btn-ghost" onClick={() => approveFine(fine.id)}>
                        Godkend
                      </button>
                      <button className="btn-ghost" onClick={() => rejectFine(fine.id)}>
                        Afvis
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showAssignModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
          <div className="card max-w-lg w-full">
            <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-ink">
                {canManageFines ? "Tildel bøde" : "Foreslå bøde"}
              </h3>
              <p className="mt-2 text-sm text-ink/70">Vælg modtager og bødeskabelon.</p>
            </div>
              <button className="btn-ghost" onClick={() => setShowAssignModal(false)}>
                Luk
              </button>
            </div>
            <form onSubmit={handleCreateFine} className="mt-4 grid gap-3">
              <div className="space-y-2">
                <label className="label">Modtager</label>
                <Combobox
                  value={fineUserId}
                  onChange={setFineUserId}
                  options={memberOptions}
                  placeholder="Vælg spiller"
                  searchPlaceholder="Søg spiller..."
                  emptyLabel="Ingen spillere matcher"
                />
              </div>
              <div className="space-y-2">
                <label className="label">Skabelon</label>
                <Combobox
                  value={selectedTemplateId}
                  onChange={setSelectedTemplateId}
                  options={templateOptions}
                  placeholder="Vælg skabelon (valgfri)"
                  searchPlaceholder="Søg skabelon..."
                  emptyLabel="Ingen skabeloner matcher"
                />
              </div>
              {!selectedTemplateId ? (
                <>
                  <div className="space-y-2">
                    <label className="label" htmlFor="fine-amount">Beløb</label>
                    <input
                      id="fine-amount"
                      type="number"
                      value={fineAmount}
                      onChange={(event) => setFineAmount(Number(event.target.value))}
                      placeholder="Beløb"
                      className="input"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label" htmlFor="fine-reason">Årsag</label>
                    <input
                      id="fine-reason"
                      value={fineReason}
                      onChange={(event) => setFineReason(event.target.value)}
                      placeholder="Årsag"
                      className="input"
                      required
                    />
                  </div>
                </>
              ) : null}
              <button className="btn-primary">{canManageFines ? "Tildel bøde" : "Foreslå bøde"}</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
