"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { getStoredTeamId, setStoredTeamId } from "@/components/appState";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/components/ToastProvider";

type FineTemplate = {
  id: string;
  title: string;
  amount: number;
  category: "SOME" | "FAELLES" | "SPILLER" | "DIVERSE";
  description?: string | null;
  status?: string;
  createdAt: string;
  createdById?: string | null;
  approvedById?: string | null;
  rejectedById?: string | null;
  createdBy?: { id: string; name: string | null } | null;
  approvedBy?: { id: string; name: string | null } | null;
  rejectedBy?: { id: string; name: string | null } | null;
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
  createdById?: string | null;
  approvedById?: string | null;
  rejectedById?: string | null;
  createdByLabel?: string | null;
  createdBy?: { name: string | null } | null;
  approvedBy?: { id: string; name: string | null } | null;
  user?: { id: string; name: string | null } | null;
  template?: FineTemplate | null;
};

type PendingPayment = {
  userId: string;
  name: string;
  total: number;
  count: number;
  requestedAt: string | null;
};

type FineCollection = {
  id: string;
  deadlineAt: string;
  intervalHours: number;
  createdAt: string;
  template: {
    id: string;
    title: string;
    amount: number;
  };
};

const fineRoles = ["BOEDEKASSEFORMAND", "ADMIN"];
const categoryOptions = [
  { value: "SOME", label: "SoMe" },
  { value: "FAELLES", label: "Fælles" },
  { value: "SPILLER", label: "Spiller" },
  { value: "DIVERSE", label: "Diverse" }
] as const;

const categoryLabel: Record<string, string> = {
  SOME: "SoMe",
  FAELLES: "Fælles",
  SPILLER: "Spiller",
  DIVERSE: "Diverse"
};

const roleLabel: Record<string, string> = {
  ADMIN: "Admin",
  TRAENER: "Træner",
  SPILLER: "Spiller",
  BOEDEKASSEFORMAND: "Bødekasse"
};

function fineStatusMeta(status: string) {
  if (status === "UNPAID") {
    return {
      label: "Ubetalt",
      className: "bg-red-100 text-red-700"
    };
  }
  if (status === "PAID_PENDING") {
    return {
      label: "Afventer godkendelse",
      className: "bg-amber-100 text-amber-800"
    };
  }
  if (status === "PAID_APPROVED") {
    return {
      label: "Betalt",
      className: "bg-green-100 text-green-700"
    };
  }
  return {
    label: status,
    className: "bg-ink/10 text-ink/70"
  };
}

function canDeleteFine(status: string) {
  return ["UNPAID", "PAID_PENDING", "FORESLAET", "AFVIST"].includes(status);
}

function CollapsibleCard({
  title,
  description,
  right,
  storageKey,
  defaultOpen = true,
  children
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "0") setOpen(false);
    if (stored === "1") setOpen(true);
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !ready) return;
    window.localStorage.setItem(storageKey, open ? "1" : "0");
  }, [open, ready, storageKey]);

  return (
    <div className="card relative">
      <button
        type="button"
        className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/20 bg-white/80 text-ink transition hover:border-ink/35 hover:bg-white"
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
      <div className="pr-14">
        <div>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          {description ? <p className="mt-2 text-sm text-ink/70">{description}</p> : null}
        </div>
      </div>
      {right ? <div className="mt-3 pr-14">{right}</div> : null}
      {open ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}

export default function BoderPage() {
  const { pushToast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");
  const defaultTeamLoadedForUserRef = useRef<string | null>(null);
  const loadedMembersKeyRef = useRef<string | null>(null);
  const loadedTemplatesKeyRef = useRef<string | null>(null);
  const loadedMyFinesKeyRef = useRef<string | null>(null);
  const loadedTeamFinesKeyRef = useRef<string | null>(null);
  const loadedTeamInfoKeyRef = useRef<string | null>(null);
  const loadedPendingPaymentsKeyRef = useRef<string | null>(null);
  const loadedCollectionsKeyRef = useRef<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<FineTemplate[]>([]);
  const [fines, setFines] = useState<FineItem[]>([]);
  const [teamFines, setTeamFines] = useState<FineItem[]>([]);
  const [teamMobilePayBox, setTeamMobilePayBox] = useState("");
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [collections, setCollections] = useState<FineCollection[]>([]);

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateAmount, setTemplateAmount] = useState(20);
  const [templateCategory, setTemplateCategory] = useState<"SOME" | "FAELLES" | "SPILLER" | "DIVERSE">("SPILLER");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");

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
  const [editCategory, setEditCategory] = useState<"SOME" | "FAELLES" | "SPILLER" | "DIVERSE">("SPILLER");
  const [editDescription, setEditDescription] = useState("");
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [createTemplateSubmitting, setCreateTemplateSubmitting] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionTemplateId, setCollectionTemplateId] = useState("");
  const [collectionDeadline, setCollectionDeadline] = useState("");
  const [collectionSubmitting, setCollectionSubmitting] = useState(false);
  const [assignFineSubmitting, setAssignFineSubmitting] = useState(false);
  const [selectedDebtorUserId, setSelectedDebtorUserId] = useState<string | null>(null);
  const [deletingFineId, setDeletingFineId] = useState<string | null>(null);

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
      const sessionUserId = session?.user?.id;
      if (!sessionUserId) {
        defaultTeamLoadedForUserRef.current = null;
        return;
      }
      if (defaultTeamLoadedForUserRef.current === sessionUserId) return;
      defaultTeamLoadedForUserRef.current = sessionUserId;

      const response = await fetch("/api/me");
      if (!response.ok) return;
      const data = await response.json();
      const memberships = data.memberships ?? [];
      const firstTeam = memberships[0]?.team?.id;
      if (!firstTeam) return;
      const currentTeamId = teamId || getStoredTeamId();
      const isCurrentValid = memberships.some(
        (membership: { team?: { id?: string } }) => membership.team?.id === currentTeamId
      );
      if (!currentTeamId || !isCurrentValid) {
        setTeamId(firstTeam);
        setStoredTeamId(firstTeam);
      }
    }

    loadDefaultTeam();
  }, [session?.user?.id, teamId]);
  const actingMember = members.find((member) => member.user.id === userId);
  const canManageFines = actingMember ? fineRoles.includes(actingMember.role) : false;
  const isAdmin = actingMember?.role === "ADMIN";

  useEffect(() => {
    async function loadMembers() {
      if (!teamId) return;
      if (loadedMembersKeyRef.current === teamId) return;
      loadedMembersKeyRef.current = teamId;
      const response = await fetch(`/api/team-members?teamId=${teamId}`);
      const data = await response.json();
      setMembers(data.members ?? []);
    }

    loadMembers();
  }, [teamId]);

  useEffect(() => {
    async function loadTemplates() {
      if (!teamId) return;
      if (loadedTemplatesKeyRef.current === teamId) return;
      loadedTemplatesKeyRef.current = teamId;
      const response = await fetch(`/api/fine-templates?teamId=${teamId}`);
      const data = await response.json();
      setTemplates(data.templates ?? []);
    }

    loadTemplates();
  }, [teamId]);

  useEffect(() => {
    async function loadFines() {
      if (!teamId || !userId) return;
      const key = `${teamId}:${userId}`;
      if (loadedMyFinesKeyRef.current === key) return;
      loadedMyFinesKeyRef.current = key;
      const response = await fetch(`/api/fines?teamId=${teamId}&userId=${userId}`);
      const data = await response.json();
      setFines(data.fines ?? []);
    }

    loadFines();
  }, [teamId, userId]);

  useEffect(() => {
    async function loadTeamFines() {
      if (!teamId) return;
      if (loadedTeamFinesKeyRef.current === teamId) return;
      loadedTeamFinesKeyRef.current = teamId;
      const response = await fetch(`/api/fines?teamId=${teamId}`);
      const data = await response.json();
      setTeamFines(data.fines ?? []);
    }

    loadTeamFines();
  }, [teamId]);

  useEffect(() => {
    async function loadTeamInfo() {
      if (!teamId) return;
      if (loadedTeamInfoKeyRef.current === teamId) return;
      loadedTeamInfoKeyRef.current = teamId;
      const response = await fetch(`/api/team/${teamId}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setTeamMobilePayBox(data.team?.mobilePayBox ?? "");
    }

    loadTeamInfo();
  }, [teamId]);

  useEffect(() => {
    async function loadPendingPayments() {
      if (!teamId || !isAdmin) {
        setPendingPayments([]);
        return;
      }
      const key = `${teamId}:${isAdmin ? "1" : "0"}`;
      if (loadedPendingPaymentsKeyRef.current === key) return;
      loadedPendingPaymentsKeyRef.current = key;
      const response = await fetch(`/api/fines/payments/pending?teamId=${teamId}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPendingPayments([]);
        return;
      }
      setPendingPayments(data.payments ?? []);
    }

    loadPendingPayments();
  }, [teamId, isAdmin]);

  useEffect(() => {
    async function loadCollections() {
      if (!teamId || !canManageFines) {
        setCollections([]);
        return;
      }
      const key = `${teamId}:${canManageFines ? "1" : "0"}`;
      if (loadedCollectionsKeyRef.current === key) return;
      loadedCollectionsKeyRef.current = key;
      const response = await fetch(`/api/fines/collections?teamId=${teamId}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCollections([]);
        return;
      }
      setCollections(data.collections ?? []);
    }

    loadCollections();
  }, [teamId, canManageFines]);

  const debtStatuses = useMemo(() => new Set(["UNPAID", "PAID_PENDING"]), []);
  const totalBoder = useMemo(
    () => fines.filter((fine) => debtStatuses.has(fine.status)).reduce((sum, fine) => sum + fine.amount, 0),
    [fines, debtStatuses]
  );
  const unpaidTotal = useMemo(
    () => fines.filter((fine) => fine.status === "UNPAID").reduce((sum, fine) => sum + fine.amount, 0),
    [fines]
  );
  const hasPendingPayment = useMemo(() => fines.some((fine) => fine.status === "PAID_PENDING"), [fines]);

  const rankedDebtors = useMemo(() => {
    const totals = new Map<string, { name: string; total: number }>();

    for (const member of members) {
      if (member.role !== "SPILLER") continue;
      totals.set(member.user.id, { name: member.user.name ?? "Ukendt", total: 0 });
    }

    for (const fine of teamFines) {
      if (!debtStatuses.has(fine.status)) continue;
      const user = fine.user;
      if (!user) continue;
      const current = totals.get(user.id) ?? { name: user.name ?? "Ukendt", total: 0 };
      current.total += fine.amount;
      totals.set(user.id, current);
    }
    return Array.from(totals.entries())
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => b.total - a.total);
  }, [members, teamFines, debtStatuses]);
  const totalAcrossDebtors = useMemo(
    () => rankedDebtors.reduce((sum, debtor) => sum + debtor.total, 0),
    [rankedDebtors]
  );
  const selectedDebtorFines = useMemo(() => {
    if (!selectedDebtorUserId) return [];
    return teamFines
      .filter(
        (fine) =>
          fine.user?.id === selectedDebtorUserId &&
          ["UNPAID", "PAID_PENDING", "PAID_APPROVED"].includes(fine.status)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedDebtorUserId, teamFines]);
  const selectedDebtorName = useMemo(() => {
    if (!selectedDebtorUserId) return "Spiller";
    return rankedDebtors.find((debtor) => debtor.id === selectedDebtorUserId)?.name ?? "Spiller";
  }, [rankedDebtors, selectedDebtorUserId]);

  async function handleCreateTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (createTemplateSubmitting) return;
    setCreateTemplateSubmitting(true);

    try {
      const response = await fetch("/api/fine-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          title: templateTitle,
          amount: Number(templateAmount),
          category: templateCategory,
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
      setTemplateCategory("SPILLER");
      setTemplateDescription("");
      setTemplates((prev) => [data.template, ...prev]);
      setShowCreateTemplateModal(false);
    } finally {
      setCreateTemplateSubmitting(false);
    }
  }

  async function handleCreateFine(event: React.FormEvent) {
    event.preventDefault();
    if (assignFineSubmitting) return;
    if (!selectedUserIds.length) {
      pushToast("Vælg mindst én spiller", "error");
      return;
    }
    setAssignFineSubmitting(true);

    try {
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
      await refreshFinesAndApprovals();
    } finally {
      setAssignFineSubmitting(false);
    }
  }

  async function refreshFinesAndApprovals() {
    if (!teamId || !userId) return;
    const tasks: Promise<Response>[] = [
      fetch(`/api/fines?teamId=${teamId}&userId=${userId}`, { cache: "no-store" }),
      fetch(`/api/fines?teamId=${teamId}`, { cache: "no-store" })
    ];
    if (isAdmin) {
      tasks.push(fetch(`/api/fines/payments/pending?teamId=${teamId}`, { cache: "no-store" }));
    }
    const [mineResponse, teamResponse, pendingResponse] = await Promise.all(tasks);
    if (mineResponse.ok) {
      const mineData = await mineResponse.json();
      setFines(mineData.fines ?? []);
    }
    if (teamResponse.ok) {
      const teamData = await teamResponse.json();
      setTeamFines(teamData.fines ?? []);
    }
    if (isAdmin && pendingResponse?.ok) {
      const pendingData = await pendingResponse.json();
      setPendingPayments(pendingData.payments ?? []);
    }
  }

  async function approveFine(id: string) {
    const response = await fetch(`/api/fines/${id}/approve`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke godkende bøde", "error");
      return;
    }
    pushToast("Bøde godkendt", "success");
    await refreshFinesAndApprovals();
  }

  async function rejectFine(id: string) {
    const response = await fetch(`/api/fines/${id}/reject`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke afvise bøde", "error");
      return;
    }
    pushToast("Bøde afvist", "success");
    await refreshFinesAndApprovals();
  }

  async function deleteFine(id: string) {
    if (deletingFineId) return;
    setDeletingFineId(id);
    try {
      const response = await fetch(`/api/fines/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke slette bøde", "error");
        return;
      }
      pushToast("Bøde slettet", "success");
      await refreshFinesAndApprovals();
    } finally {
      setDeletingFineId(null);
    }
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

  async function handleRequestPaymentApproval() {
    if (!teamId || unpaidTotal <= 0) return;
    setPaySubmitting(true);
    try {
      const response = await fetch("/api/fines/payments/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke markere bøder som betalt", "error");
        return;
      }
      pushToast("Betaling markeret. Afventer admin-godkendelse.", "success");
      setShowPayModal(false);
      await refreshFinesAndApprovals();
    } finally {
      setPaySubmitting(false);
    }
  }

  async function approvePayment(userIdToApprove: string) {
    if (!teamId) return;
    const response = await fetch(`/api/fines/payments/${userIdToApprove}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke godkende betaling", "error");
      return;
    }
    pushToast("Betaling godkendt", "success");
    await refreshFinesAndApprovals();
  }

  async function rejectPayment(userIdToReject: string) {
    if (!teamId) return;
    const response = await fetch(`/api/fines/payments/${userIdToReject}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke afvise betaling", "error");
      return;
    }
    pushToast("Betaling afvist", "success");
    await refreshFinesAndApprovals();
  }

  async function copyMobilePayBox() {
    if (!teamMobilePayBox) return;
    try {
      await navigator.clipboard.writeText(teamMobilePayBox);
      pushToast("MobilePay box kopieret", "success");
    } catch {
      pushToast("Kunne ikke kopiere box-nummer", "error");
    }
  }

  async function createCollectionRule(event: React.FormEvent) {
    event.preventDefault();
    if (!teamId || !collectionTemplateId || !collectionDeadline) {
      pushToast("Vælg skabelon og deadline", "error");
      return;
    }
    setCollectionSubmitting(true);
    try {
      const deadlineIso = new Date(collectionDeadline).toISOString();
      const response = await fetch("/api/fines/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          templateId: collectionTemplateId,
          deadlineAt: deadlineIso
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke oprette indsamlingsflow", "error");
        return;
      }
      pushToast("Indsamlingsflow oprettet", "success");
      setCollections((prev) => [data.collection, ...prev]);
      setShowCollectionModal(false);
      setCollectionTemplateId("");
      setCollectionDeadline("");
    } finally {
      setCollectionSubmitting(false);
    }
  }

  function creatorLabel(fine: FineItem) {
    return fine.createdBy?.name ?? fine.createdByLabel ?? "System";
  }

  const memberNameById = useMemo(() => {
    return new Map(members.map((member) => [member.user.id, member.user.name]));
  }, [members]);

  const pendingFines = teamFines.filter((fine) => fine.status === "FORESLAET");
  const templateSearchNeedle = templateSearch.trim().toLowerCase();
  const matchesTemplateSearch = (template: FineTemplate) => {
    if (!templateSearchNeedle) return true;
    const haystack = `${template.title} ${template.description ?? ""}`.toLowerCase();
    return haystack.includes(templateSearchNeedle);
  };
  const filteredMembers = members.filter((member) =>
    member.user.name?.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const approvedTemplates = templates.filter((template) => template.status === "APPROVED" || !template.status);
  const filteredApprovedTemplates = approvedTemplates.filter(matchesTemplateSearch);
  const pendingTemplates = templates
    .filter((template) => template.status === "PENDING")
    .filter(matchesTemplateSearch);
  const templateOptions = approvedTemplates.map((template) => ({
      value: template.id,
      label: `${categoryLabel[template.category] ?? template.category} · ${template.title}`,
      rightLabel: `${template.amount} kr`,
      searchLabel: `${categoryLabel[template.category] ?? template.category} ${template.title} ${template.amount} ${
        template.description ?? ""
      }`
    }));
  const collectionTemplateOptions = approvedTemplates.map((template) => ({
    value: template.id,
    label: `${template.title} (${template.amount} kr)`
  }));

  const myFineRequests = teamFines
    .filter((fine) => fine.createdById === userId)
    .filter(
      (fine) =>
        fine.status === "FORESLAET" ||
        fine.status === "AFVIST" ||
        Boolean(fine.approvedById) ||
        Boolean(fine.rejectedById)
    );

  const myTemplateRequests = templates
    .filter((template) => template.createdById === userId)
    .filter(
      (template) => template.status === "PENDING" || template.status === "REJECTED" || Boolean(template.approvedById)
    );

  const myRequests = useMemo(() => {
    const fineItems = myFineRequests.map((fine) => {
      const resolvedApprover =
        fine.approvedBy?.name ??
        (fine.approvedById ? memberNameById.get(fine.approvedById) : null) ??
        (fine.rejectedById ? memberNameById.get(fine.rejectedById) : null);
      const statusLabel =
        fine.status === "FORESLAET"
          ? "Afventer godkendelse"
          : fine.status === "AFVIST"
          ? "Afvist"
          : "Godkendt";
      const actorLabel =
        fine.status === "FORESLAET"
          ? null
          : `${fine.status === "AFVIST" ? "Afvist af" : "Godkendt af"} ${resolvedApprover ?? "ukendt"}`;
      return {
        id: `fine-${fine.id}`,
        createdAt: fine.createdAt,
        kindLabel: "Bøde",
        title: fine.reason,
        amount: fine.amount,
        statusLabel,
        actorLabel
      };
    });

    const templateItems = myTemplateRequests.map((template) => {
      const resolvedApprover =
        template.approvedBy?.name ??
        template.rejectedBy?.name ??
        (template.approvedById ? memberNameById.get(template.approvedById) : null) ??
        (template.rejectedById ? memberNameById.get(template.rejectedById) : null);
      const statusLabel =
        template.status === "PENDING"
          ? "Afventer godkendelse"
          : template.status === "REJECTED"
          ? "Afvist"
          : "Godkendt";
      const actorLabel =
        template.status === "PENDING"
          ? null
          : `${template.status === "REJECTED" ? "Afvist af" : "Godkendt af"} ${resolvedApprover ?? "ukendt"}`;
      return {
        id: `template-${template.id}`,
        createdAt: template.createdAt,
        kindLabel: "Skabelon",
        title: template.title,
        amount: template.amount,
        statusLabel,
        actorLabel
      };
    });

    return [...fineItems, ...templateItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [memberNameById, myFineRequests, myTemplateRequests]);

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
    setEditCategory(template.category ?? "SPILLER");
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
        category: editCategory,
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

  async function handleDeleteTemplate() {
    if (!editingTemplate) return;
    const response = await fetch(`/api/fine-templates/${editingTemplate.id}`, {
      method: "DELETE"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke slette skabelon", "error");
      return;
    }
    setTemplates((prev) => prev.filter((item) => item.id !== editingTemplate.id));
    pushToast("Skabelon slettet", "success");
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
        {unpaidTotal > 0 ? (
          <button className="btn-ghost" onClick={() => setShowPayModal(true)}>
            Betal bøder
          </button>
        ) : null}
        {canManageFines ? (
          <button
            className="btn-ghost"
            onClick={() => {
              if (!collectionDeadline) {
                const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
                const local = new Date(nextDay.getTime() - nextDay.getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16);
                setCollectionDeadline(local);
              }
              setShowCollectionModal(true);
            }}
          >
            Indsaml bøder
          </button>
        ) : null}
        {canManageFines ? (
          <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">Bødekasseformand</span>
        ) : null}
        {hasPendingPayment ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Betaling afventer godkendelse
          </span>
        ) : null}
      </div>

      <CollapsibleCard
        title="Mine bøder"
        description="Overblik over dine egne bøder."
        storageKey={`holdbold:boder:${teamId}:${userId}:mine-boder`}
        right={<div className="rounded-full bg-ember/10 px-4 py-2 text-sm font-semibold text-ember">Total: {totalBoder} kr</div>}
      >
        <div className="grid gap-3">
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
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">{fine.amount} kr</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${fineStatusMeta(fine.status).className}`}
                    >
                      {fineStatusMeta(fine.status).label}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CollapsibleCard>

      {isAdmin && pendingPayments.length > 0 ? (
        <CollapsibleCard
          title="Betalinger til godkendelse"
          description="Spillere der har markeret deres bøder som betalt."
          storageKey={`holdbold:boder:${teamId}:${userId}:pending-payments`}
        >
          <div className="space-y-3">
            {pendingPayments.map((payment) => (
              <div key={payment.userId} className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{payment.name}</p>
                    <p className="text-xs text-ink/60">
                      {payment.count} bøder · Markeret{" "}
                      {payment.requestedAt
                        ? new Date(payment.requestedAt).toLocaleString("da-DK")
                        : "ukendt tidspunkt"}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-ink">{payment.total} kr</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn-ghost" onClick={() => approvePayment(payment.userId)}>
                    Godkend
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => rejectPayment(payment.userId)}>
                    Afvis
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      ) : null}

      {canManageFines && pendingFines.length > 0 ? (
        <CollapsibleCard
          title="Afventer godkendelse (bøder)"
          description="Godkend eller afvis bøder foreslået af spillere."
          storageKey={`holdbold:boder:${teamId}:${userId}:pending-boder`}
        >
          <div className="space-y-3">
            {pendingFines.map((fine) => (
              <div key={fine.id} className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
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
                  {canDeleteFine(fine.status) ? (
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => deleteFine(fine.id)}
                      aria-label="Slet bøde"
                      title="Slet bøde"
                      disabled={deletingFineId === fine.id}
                    >
                      {deletingFineId === fine.id ? (
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600"
                          aria-hidden="true"
                        />
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                          <path
                            d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 7l1 12a1 1 0 0 0 1 .92h4a1 1 0 0 0 1-.92L16 7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      ) : null}

      <CollapsibleCard
        title="Mine anmodninger"
        description="Dine foreslåede bøder og skabeloner med status."
        storageKey={`holdbold:boder:${teamId}:${userId}:mine-anmodninger`}
      >
        <div className="space-y-3">
          {myRequests.length === 0 ? (
            <p className="text-sm text-ink/60">Ingen anmodninger endnu.</p>
          ) : (
            myRequests.map((requestItem) => {
              const badgeClass =
                requestItem.statusLabel === "Afventer godkendelse"
                  ? "bg-amber-100 text-amber-800"
                  : requestItem.statusLabel === "Afvist"
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700";
              return (
                <div key={requestItem.id} className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{requestItem.title}</p>
                      <p className="text-xs text-ink/60">
                        {requestItem.kindLabel} · {new Date(requestItem.createdAt).toLocaleDateString("da-DK")}
                      </p>
                      {requestItem.actorLabel ? (
                        <p className="text-xs text-ink/60">{requestItem.actorLabel}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-ink">{requestItem.amount} kr</div>
                      <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                        {requestItem.statusLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Top skyldnere"
        description="Samlet bødebeløb pr. spiller."
        storageKey={`holdbold:boder:${teamId}:${userId}:top-skyldnere`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/60">
              {rankedDebtors.length} spillere
            </span>
            <span className="rounded-full bg-ember/10 px-3 py-1 text-xs font-semibold text-ember">
              Samlet: {totalAcrossDebtors} kr
            </span>
          </div>
        }
      >
        <div className="overflow-hidden rounded-2xl border border-ink/10">
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
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left font-semibold text-ink hover:text-moss"
                        onClick={() => setSelectedDebtorUserId(debtor.id)}
                      >
                        {debtor.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{debtor.total} kr</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Bødeskabeloner"
        description={
          canManageFines
            ? "Genbrug skabeloner som “Mødt for sent” eller “Mangler afmelding”."
            : "Foreslå nye bødeskabeloner til godkendelse."
        }
        storageKey={`holdbold:boder:${teamId}:${userId}:skabeloner`}
        right={
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/20 bg-white/80 text-xl font-semibold text-ink transition hover:border-ink/35 hover:bg-white"
            onClick={() => setShowCreateTemplateModal(true)}
            aria-label={canManageFines ? "Opret bødeskabelon" : "Foreslå bødeskabelon"}
            title={canManageFines ? "Opret bødeskabelon" : "Foreslå bødeskabelon"}
          >
            +
          </button>
        }
      >
        {canManageFines && collections.length > 0 ? (
          <div className="space-y-2">
            <p className="label">Aktive indsamlingsflows</p>
            <div className="space-y-2">
              {collections.map((collection) => (
                <div key={collection.id} className="rounded-2xl border border-ink/10 bg-white/80 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{collection.template.title}</p>
                  <p className="text-xs text-ink/60">
                    Fra {new Date(collection.deadlineAt).toLocaleString("da-DK")} · hver {collection.intervalHours}. time ·{" "}
                    {collection.template.amount} kr
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <label className="label" htmlFor="template-search">Søg i skabeloner</label>
          <input
            id="template-search"
            value={templateSearch}
            onChange={(event) => setTemplateSearch(event.target.value)}
            placeholder="Søg på titel eller beskrivelse..."
            className="input"
          />
        </div>

        {canManageFines && pendingTemplates.length > 0 ? (
          <div className="mt-6 space-y-3">
            <p className="label">Afventer godkendelse (skabeloner)</p>
            {pendingTemplates.map((template) => (
              <div key={template.id} className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{template.title}</p>
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-semibold text-ink/70">
                        {categoryLabel[template.category] ?? template.category}
                      </span>
                    </div>
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

        <div className="mt-6 space-y-3">
          {filteredApprovedTemplates.length === 0 ? (
            <p className="text-sm text-ink/60">
              {templateSearchNeedle ? "Ingen skabeloner matcher søgningen." : "Ingen godkendte skabeloner endnu."}
            </p>
          ) : (
            filteredApprovedTemplates.map((template) => (
              <div key={template.id} className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{template.title}</p>
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-semibold text-ink/70">
                        {categoryLabel[template.category] ?? template.category}
                      </span>
                    </div>
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
      </CollapsibleCard>

      {showPayModal ? (
        <div className="modal-backdrop" onClick={() => setShowPayModal(false)}>
          <div className="modal-panel max-w-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Betal bøder</h3>
                <p className="mt-2 text-sm text-ink/70">Følg disse trin for at betale dine ubetalte bøder.</p>
              </div>
              <button className="btn-ghost" onClick={() => setShowPayModal(false)}>
                Luk
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-ink/80">
              <li className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                <p className="font-semibold text-ink">1) Kopiér MobilePay box</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink">
                    {teamMobilePayBox || "Ikke sat endnu"}
                  </code>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={copyMobilePayBox}
                    disabled={!teamMobilePayBox}
                    aria-label="Kopiér MobilePay box"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path
                          d="M9 9h10v12H9zM5 3h10v4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Kopiér
                    </span>
                  </button>
                </div>
              </li>
              <li className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                <p className="font-semibold text-ink">2) Beløb der skal betales</p>
                <p className="mt-2 text-base font-semibold text-ember">{unpaidTotal} kr</p>
              </li>
              <li className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                <p className="font-semibold text-ink">3) Betal i MobilePay</p>
                <p className="mt-2 text-ink/70">Åbn MobilePay og betal beløbet til boxen ovenfor.</p>
              </li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={handleRequestPaymentApproval}
                disabled={paySubmitting || unpaidTotal <= 0 || !teamMobilePayBox}
              >
                {paySubmitting ? "Sender..." : "Jeg har betalt mine bøder"}
              </button>
              {!teamMobilePayBox ? <p className="text-xs text-red-600">MobilePay box er ikke sat af admin endnu.</p> : null}
            </div>
            <p className="mt-3 text-xs text-ink/60">
              Når du markerer som betalt, skal en admin godkende betalingen.
            </p>
          </div>
        </div>
      ) : null}

      {showCollectionModal ? (
        <div className="modal-backdrop" onClick={() => setShowCollectionModal(false)}>
          <div className="modal-panel max-w-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Indsaml bøder</h3>
                <p className="mt-2 text-sm text-ink/70">
                  Vælg deadline og skabelon. Efter deadline gives bøden automatisk hver 24. time ved ubetalte bøder.
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setShowCollectionModal(false)}>
                Luk
              </button>
            </div>
            <form className="mt-4 grid gap-3" onSubmit={createCollectionRule}>
              <div className="space-y-2">
                <label className="label" htmlFor="collection-template">Bødeskabelon</label>
                <select
                  id="collection-template"
                  className="input"
                  value={collectionTemplateId}
                  onChange={(event) => setCollectionTemplateId(event.target.value)}
                  required
                >
                  <option value="">Vælg skabelon</option>
                  {collectionTemplateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="collection-deadline">Deadline</label>
                <input
                  id="collection-deadline"
                  type="datetime-local"
                  className="input"
                  value={collectionDeadline}
                  onChange={(event) => setCollectionDeadline(event.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary" disabled={collectionSubmitting}>
                {collectionSubmitting ? "Opretter..." : "Opret indsamlingsflow"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {selectedDebtorUserId ? (
        <div className="modal-backdrop" onClick={() => setSelectedDebtorUserId(null)}>
          <div className="modal-panel max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">{selectedDebtorName} · bøder</h3>
                <p className="mt-2 text-sm text-ink/70">Alle registrerede bøder for spilleren.</p>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedDebtorUserId(null)}>
                Luk
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {selectedDebtorFines.length === 0 ? (
                <p className="text-sm text-ink/60">Ingen bøder fundet.</p>
              ) : (
                selectedDebtorFines.map((fine) => (
                  <div key={fine.id} className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{fine.reason}</p>
                        <p className="text-xs text-ink/60">
                          {new Date(fine.createdAt).toLocaleString("da-DK")} · {creatorLabel(fine)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-ink whitespace-nowrap">{fine.amount} kr</p>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${fineStatusMeta(fine.status).className}`}
                        >
                          {fineStatusMeta(fine.status).label}
                        </span>
                        {canManageFines && canDeleteFine(fine.status) ? (
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => deleteFine(fine.id)}
                            aria-label="Slet bøde"
                            title="Slet bøde"
                            disabled={deletingFineId === fine.id}
                          >
                            {deletingFineId === fine.id ? (
                              <span
                                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600"
                                aria-hidden="true"
                              />
                            ) : (
                              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                                <path
                                  d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 7l1 12a1 1 0 0 0 1 .92h4a1 1 0 0 0 1-.92L16 7"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showCreateTemplateModal ? (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (createTemplateSubmitting) return;
            setShowCreateTemplateModal(false);
          }}
        >
          <div className="modal-panel max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  {canManageFines ? "Opret bødeskabelon" : "Foreslå bødeskabelon"}
                </h3>
                <p className="mt-2 text-sm text-ink/70">
                  {canManageFines
                    ? "Skabelonen bliver klar til brug med det samme."
                    : "Skabelonen sendes til godkendelse hos bødeformand/admin."}
                </p>
              </div>
              <button
                className="btn-ghost"
                onClick={() => setShowCreateTemplateModal(false)}
                disabled={createTemplateSubmitting}
              >
                Luk
              </button>
            </div>
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
                <label className="label" htmlFor="template-category">Kategori</label>
                <select
                  id="template-category"
                  value={templateCategory}
                  onChange={(event) =>
                    setTemplateCategory(event.target.value as "SOME" | "FAELLES" | "SPILLER" | "DIVERSE")
                  }
                  className="input"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
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
              <button className="btn-primary sm:col-span-2" disabled={createTemplateSubmitting}>
                {createTemplateSubmitting
                  ? "Gemmer..."
                  : canManageFines
                  ? "Opret skabelon"
                  : "Foreslå skabelon"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showAssignModal ? (
        <div
          className="modal-backdrop assign-backdrop"
          onClick={() => {
            if (assignFineSubmitting) return;
            setShowAssignModal(false);
            setSelectedUserIds([]);
            setMemberSearch("");
            setSelectedTemplateId("");
          }}
        >
          <div className="modal-panel assign-panel max-w-lg" onClick={(event) => event.stopPropagation()}>
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
                  if (assignFineSubmitting) return;
                  setShowAssignModal(false);
                  setSelectedUserIds([]);
                  setMemberSearch("");
                  setSelectedTemplateId("");
                }}
                disabled={assignFineSubmitting}
              >
                Luk
              </button>
            </div>
            <form onSubmit={handleCreateFine} className="mt-4 grid min-w-0 gap-3">
              <div className="space-y-2">
                <label className="label">Modtagere</label>
                <input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Søg spiller..."
                  className="input"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-full border border-ink/15 bg-white/70 p-1">
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        selectedUserIds.length > 0 && selectedUserIds.length === filteredMembers.length
                          ? "bg-ink text-fog"
                          : "text-ink/70 hover:bg-ink/5"
                      }`}
                      onClick={() => setSelectedUserIds(filteredMembers.map((member) => member.user.id))}
                    >
                      Alle
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        selectedUserIds.length === 0
                          ? "bg-ink text-fog"
                          : "text-ink/70 hover:bg-ink/5"
                      }`}
                      onClick={() => setSelectedUserIds([])}
                    >
                      Ingen
                    </button>
                  </div>
                  <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/70">
                    {selectedUserIds.length} valgt
                  </span>
                </div>
                <div className="max-h-[34vh] space-y-2 overflow-auto rounded-2xl border border-ink/10 bg-white/80 p-3">
                  {filteredMembers.length === 0 ? (
                    <p className="text-sm text-ink/60">Ingen spillere matcher.</p>
                  ) : (
                    filteredMembers.map((member) => {
                      const checked = selectedUserIds.includes(member.user.id);
                      return (
                        <label
                          key={member.user.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white/70 px-3 py-2 text-sm text-ink/85"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-ink/30"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedUserIds((prev) =>
                                event.target.checked
                                  ? [...prev, member.user.id]
                                  : prev.filter((id) => id !== member.user.id)
                              );
                            }}
                          />
                            <span className="truncate">{member.user.name}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-semibold text-ink/70">
                            {roleLabel[member.role] ?? member.role}
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
              <button className="btn-primary w-full" disabled={assignFineSubmitting}>
                {assignFineSubmitting
                  ? "Gemmer..."
                  : canManageFines
                  ? "Tildel bøde"
                  : "Foreslå bøde"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showEditModal && editingTemplate ? (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-panel max-w-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Rediger skabelon</h3>
                <p className="mt-2 text-sm text-ink/70">Opdater titel, beløb eller beskrivelse.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                  onClick={handleDeleteTemplate}
                  aria-label="Slet skabelon"
                  title="Slet skabelon"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                    <path
                      d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 7l1 12a1 1 0 0 0 1 .92h4a1 1 0 0 0 1-.92L16 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button className="btn-ghost" onClick={() => setShowEditModal(false)}>
                  Luk
                </button>
              </div>
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
                <label className="label" htmlFor="edit-category">Kategori</label>
                <select
                  id="edit-category"
                  value={editCategory}
                  onChange={(event) =>
                    setEditCategory(event.target.value as "SOME" | "FAELLES" | "SPILLER" | "DIVERSE")
                  }
                  className="input"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
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
