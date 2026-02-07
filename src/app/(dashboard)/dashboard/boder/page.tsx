"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { getStoredTeamId, setStoredTeamId } from "@/components/appState";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/components/ToastProvider";

type FineTemplate = {
  id: string;
  title: string;
  amount: number;
  description?: string | null;
  status?: string;
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
  const { pushToast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<FineTemplate[]>([]);
  const [fines, setFines] = useState<FineItem[]>([]);
  const [teamFines, setTeamFines] = useState<FineItem[]>([]);

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateAmount, setTemplateAmount] = useState(20);
  const [templateDescription, setTemplateDescription] = useState("");

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [fineAmount, setFineAmount] = useState(50);
  const [fineReason, setFineReason] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FineTemplate | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState(20);
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    setTeamId(getStoredTeamId());
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    async function loadDefaultTeam() {
      if (teamId || !session?.user?.id) return;
      const response = await fetch("/api/me");
      if (!response.ok) return;
      const data = await response.json();
      const firstTeam = data.memberships?.[0]?.team?.id;
      if (firstTeam) {
        setTeamId(firstTeam);
        setStoredTeamId(firstTeam);
      }
    }

    loadDefaultTeam();
  }, [teamId, session?.user?.id]);
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
      pushToast(data.error ?? "Kunne ikke oprette bødeskabelon", "error");
      return;
    }

    pushToast("Bødeskabelon oprettet", "success");
    setTemplateTitle("");
    setTemplateAmount(20);
    setTemplateDescription("");
    setTemplates((prev) => [data.template, ...prev]);
  }

  async function handleCreateFine(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUserIds.length) {
      pushToast("Vælg mindst én spiller", "error");
      return;
    }

    const recipients = selectedUserIds;
    const payloadBase: Record<string, unknown> = {
      teamId,
      createdById: userId || undefined
    };

    if (selectedTemplateId) {
      payloadBase.templateId = selectedTemplateId;
    } else {
      payloadBase.amount = Number(fineAmount);
      payloadBase.reason = fineReason;
    }

    const responses = await Promise.all(
      recipients.map((recipientId) =>
        fetch("/api/fines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloadBase, userId: recipientId })
        })
      )
    );
    const failed = responses.find((response) => !response.ok);
    if (failed) {
      const data = await failed.json().catch(() => ({}));
      pushToast(data.error ?? "Kunne ikke oprette bøde", "error");
      return;
    }

    pushToast(canManageFines ? "Bøder tildelt" : "Bøder foreslået", "success");
    setShowAssignModal(false);
    setSelectedUserIds([]);
  }

  async function approveFine(id: string) {
    await fetch(`/api/fines/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedById: userId })
    });
    setTeamFines((prev) => prev.map((fine) => (fine.id === id ? { ...fine, status: "UNPAID" } : fine)));
    pushToast("Bøde godkendt", "success");
  }

  async function rejectFine(id: string) {
    await fetch(`/api/fines/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectedById: userId })
    });
    setTeamFines((prev) => prev.map((fine) => (fine.id === id ? { ...fine, status: "AFVIST" } : fine)));
    pushToast("Bøde afvist", "success");
  }

  async function approveTemplate(id: string) {
    const response = await fetch(`/api/fine-templates/${id}/approve`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke godkende skabelon", "error");
      return;
    }
    setTemplates((prev) => prev.map((item) => (item.id === id ? data.template : item)));
    pushToast("Skabelon godkendt", "success");
  }

  async function rejectTemplate(id: string) {
    const response = await fetch(`/api/fine-templates/${id}/reject`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke afvise skabelon", "error");
      return;
    }
    setTemplates((prev) => prev.map((item) => (item.id === id ? data.template : item)));
    pushToast("Skabelon afvist", "success");
  }

  function creatorLabel(fine: FineItem) {
    return fine.createdBy?.name ?? fine.createdByLabel ?? "System";
  }

  const pendingFines = teamFines.filter((fine) => fine.status === "FORESLAET");
  const filteredMembers = members.filter((member) =>
    member.user.name?.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const templateOptions = templates
    .filter((template) => template.status === "APPROVED" || !template.status)
    .map((template) => ({
      value: template.id,
      label: `${template.title} (${template.amount} kr)`
    }));

  const pendingTemplates = templates.filter((template) => template.status === "PENDING");

  if (sessionStatus === "loading") {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Bøder</h2>
        <p className="mt-2 text-ink/70">Indlæser...</p>
      </section>
    );
  }

  if (!session?.user?.id) {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Bøder</h2>
        <p className="mt-2 text-ink/70">Du skal være logget ind for at se bøder.</p>
      </section>
    );
  }

  if (!teamId) {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Bøder</h2>
        <p className="mt-2 text-ink/70">Vælg aktivt hold i Indstillinger for at fortsætte.</p>
      </section>
    );
  }

  function openEditTemplate(template: FineTemplate) {
    setEditingTemplate(template);
    setEditTitle(template.title);
    setEditAmount(template.amount);
    setEditDescription(template.description ?? "");
    setShowEditModal(true);
  }

  async function handleUpdateTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (!editingTemplate) return;
    const response = await fetch(`/api/fine-templates/${editingTemplate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        amount: Number(editAmount),
        description: editDescription || undefined
      })
    });
    const data = await response.json();
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke opdatere skabelon", "error");
      return;
    }
    setTemplates((prev) => prev.map((item) => (item.id === editingTemplate.id ? data.template : item)));
    pushToast("Skabelon opdateret", "success");
    setShowEditModal(false);
    setEditingTemplate(null);
  }

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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="text-lg font-semibold text-ink">Bødeskabeloner</h3>
          <p className="mt-2 text-sm text-ink/70">
            {canManageFines
              ? "Genbrug skabeloner som “Mødt for sent” eller “Mangler afmelding”."
              : "Foreslå nye bødeskabeloner til godkendelse."}
          </p>
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
            <div className="mt-6 space-y-3">
              {templates.length === 0 ? (
                <p className="text-sm text-ink/60">Ingen skabeloner endnu.</p>
              ) : (
                templates.map((template) => (
                  <div key={template.id} className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{template.title}</p>
                        {template.description ? (
                          <p className="text-xs text-ink/60">{template.description}</p>
                        ) : null}
                      </div>
                      <div className="text-sm font-semibold text-ink">{template.amount} kr</div>
                    </div>
                    {canManageFines ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="btn-ghost" onClick={() => openEditTemplate(template)}>
                          Rediger
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            setSelectedTemplateId(template.id);
                            setShowAssignModal(true);
                          }}
                        >
                          Tildel
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            {pendingTemplates.length > 0 ? (
              <div className="mt-6 space-y-3">
                <p className="label">Afventer godkendelse</p>
                {pendingTemplates.map((template) => (
                  <div key={template.id} className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{template.title}</p>
                        {template.description ? (
                          <p className="text-xs text-ink/60">{template.description}</p>
                        ) : null}
                      </div>
                      <div className="text-sm font-semibold text-ink">{template.amount} kr</div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="btn-ghost" onClick={() => approveTemplate(template.id)}>
                        Godkend
                      </button>
                      <button className="btn-ghost" onClick={() => rejectTemplate(template.id)}>
                        Afvis
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
        </div>

        {canManageFines ? (
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
        ) : null}
      </div>

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
              <button
                className="btn-ghost"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUserIds([]);
                  setMemberSearch("");
                  setSelectedTemplateId("");
                }}
              >
                Luk
              </button>
            </div>
            <form onSubmit={handleCreateFine} className="mt-4 grid gap-3">
              <div className="space-y-2">
                <label className="label">Modtagere</label>
                <input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Søg spiller..."
                  className="input"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setSelectedUserIds(filteredMembers.map((member) => member.user.id))}
                  >
                    Vælg alle
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setSelectedUserIds([])}>
                    Ryd
                  </button>
                </div>
                <div className="max-h-48 space-y-2 overflow-auto rounded-2xl border border-ink/10 bg-white/80 p-3">
                  {filteredMembers.length === 0 ? (
                    <p className="text-sm text-ink/60">Ingen spillere matcher.</p>
                  ) : (
                    filteredMembers.map((member) => {
                      const checked = selectedUserIds.includes(member.user.id);
                      return (
                        <label key={member.user.id} className="flex items-center gap-2 text-sm text-ink/80">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedUserIds((prev) =>
                                event.target.checked
                                  ? [...prev, member.user.id]
                                  : prev.filter((id) => id !== member.user.id)
                              );
                            }}
                          />
                          <span>
                            {member.user.name} <span className="text-ink/50">({member.role})</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
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

      {showEditModal && editingTemplate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
          <div className="card max-w-lg w-full">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Rediger skabelon</h3>
                <p className="mt-2 text-sm text-ink/70">Opdater titel, beløb eller beskrivelse.</p>
              </div>
              <button className="btn-ghost" onClick={() => setShowEditModal(false)}>
                Luk
              </button>
            </div>
            <form onSubmit={handleUpdateTemplate} className="mt-4 grid gap-3">
              <div className="space-y-2">
                <label className="label" htmlFor="edit-title">Titel</label>
                <input
                  id="edit-title"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="input"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="edit-amount">Beløb</label>
                <input
                  id="edit-amount"
                  type="number"
                  value={editAmount}
                  onChange={(event) => setEditAmount(Number(event.target.value))}
                  className="input"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="edit-desc">Beskrivelse</label>
                <input
                  id="edit-desc"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  className="input"
                />
              </div>
              <button className="btn-primary">Gem ændringer</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
