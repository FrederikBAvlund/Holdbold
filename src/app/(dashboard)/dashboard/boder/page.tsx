"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/components/ToastProvider";
import LoadingButton from "@/components/LoadingButton";
import { TrashIcon } from "@/components/TrashIcon";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { FineEventLink } from "./FineEventLink";
import { categoryLabel, categoryOptions, fineRoles, roleLabel } from "./boderConstants";
import type { FineCollection, FineItem, FineTemplate, Member, PendingPayment } from "./boderTypes";
import {
  canDeleteFine,
  fineAmountClass,
  formatFineKr,
  fineStatusMeta,
  parseIntegerAmountInput
} from "./boderUtils";

export default function BoderPage() {
  const { pushToast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const { teamId, userId, members: teamMembers, actingMember } = useDashboardTeam();
  const members = teamMembers as Member[];
  const loadedTemplatesKeyRef = useRef<string | null>(null);
  const loadedMyFinesKeyRef = useRef<string | null>(null);
  const loadedTeamFineViewsKeyRef = useRef<string | null>(null);
  const loadedTeamInfoKeyRef = useRef<string | null>(null);
  const loadedPendingPaymentsKeyRef = useRef<string | null>(null);
  const loadedCollectionsKeyRef = useRef<string | null>(null);

  const [templates, setTemplates] = useState<FineTemplate[]>([]);
  const [fines, setFines] = useState<FineItem[]>([]);
  const [debtorTotals, setDebtorTotals] = useState<Array<{ userId: string; name: string; total: number }>>([]);
  const [managementFines, setManagementFines] = useState<FineItem[]>([]);
  const [historyFines, setHistoryFines] = useState<FineItem[]>([]);
  const [mySubmittedFines, setMySubmittedFines] = useState<FineItem[]>([]);
  const [selectedDebtorFines, setSelectedDebtorFines] = useState<FineItem[]>([]);
  const [teamMobilePayBox, setTeamMobilePayBox] = useState("");
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [collections, setCollections] = useState<FineCollection[]>([]);

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateAmount, setTemplateAmount] = useState("20");
  const [templateCategory, setTemplateCategory] = useState<"SOME" | "FAELLES" | "SPILLER" | "DIVERSE">("SPILLER");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [fineAmount, setFineAmount] = useState("50");
  const [fineTitle, setFineTitle] = useState("");
  const [fineDescription, setFineDescription] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FineTemplate | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("20");
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
  const [copySubmitting, setCopySubmitting] = useState(false);
  const [pendingPaymentAction, setPendingPaymentAction] = useState<{ userId: string; action: "approve" | "reject" } | null>(null);
  const [pendingFineAction, setPendingFineAction] = useState<{ fineId: string; action: "approve" | "reject" } | null>(null);
  const [pendingTemplateAction, setPendingTemplateAction] = useState<{ templateId: string; action: "approve" | "reject" } | null>(null);
  const [updateTemplateSubmitting, setUpdateTemplateSubmitting] = useState(false);
  const [deleteTemplateSubmitting, setDeleteTemplateSubmitting] = useState(false);

  const canManageFines = actingMember ? fineRoles.includes(actingMember.role) : false;
  const isAdmin = actingMember?.role === "ADMIN";

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
    async function loadTeamFineViews() {
      if (!teamId || !userId) return;
      const key = `${teamId}:${userId}:${canManageFines ? "1" : "0"}`;
      if (loadedTeamFineViewsKeyRef.current === key) return;
      loadedTeamFineViewsKeyRef.current = key;

      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const tasks: Promise<Response>[] = [
        fetch(`/api/fines/debtors?teamId=${teamId}`, { cache: "no-store" }),
        fetch(`/api/fines?teamId=${teamId}&since=${encodeURIComponent(since)}`, { cache: "no-store" }),
        fetch(`/api/fines?teamId=${teamId}&createdById=${userId}`, { cache: "no-store" })
      ];
      if (canManageFines) {
        tasks.push(fetch(`/api/fines?teamId=${teamId}&status=FORESLAET`, { cache: "no-store" }));
      }

      const [debtorsResponse, historyResponse, mySubmittedResponse, managementResponse] = await Promise.all(tasks);

      if (debtorsResponse.ok) {
        const data = await debtorsResponse.json();
        setDebtorTotals(data.debtors ?? []);
      } else {
        setDebtorTotals([]);
      }

      if (historyResponse.ok) {
        const data = await historyResponse.json();
        setHistoryFines(data.fines ?? []);
      } else {
        setHistoryFines([]);
      }

      if (mySubmittedResponse.ok) {
        const data = await mySubmittedResponse.json();
        setMySubmittedFines(data.fines ?? []);
      } else {
        setMySubmittedFines([]);
      }

      if (canManageFines && managementResponse?.ok) {
        const data = await managementResponse.json();
        setManagementFines(data.fines ?? []);
      } else if (!canManageFines) {
        setManagementFines([]);
      }
    }

    loadTeamFineViews();
  }, [teamId, userId, canManageFines]);

  useEffect(() => {
    async function loadSelectedDebtorFines() {
      if (!teamId || !selectedDebtorUserId) {
        setSelectedDebtorFines([]);
        return;
      }
      const response = await fetch(
        `/api/fines?teamId=${teamId}&userId=${selectedDebtorUserId}`,
        { cache: "no-store" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSelectedDebtorFines([]);
        return;
      }
      setSelectedDebtorFines(data.fines ?? []);
    }

    loadSelectedDebtorFines();
  }, [teamId, selectedDebtorUserId]);

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
      totals.set(member.user.id, { name: member.user.name ?? "Ukendt", total: 0 });
    }

    for (const debtor of debtorTotals) {
      const current = totals.get(debtor.userId) ?? { name: debtor.name, total: 0 };
      current.total = debtor.total;
      totals.set(debtor.userId, current);
    }
    return Array.from(totals.entries())
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => b.total - a.total);
  }, [members, debtorTotals]);
  const totalAcrossDebtors = useMemo(
    () => rankedDebtors.reduce((sum, debtor) => sum + debtor.total, 0),
    [rankedDebtors]
  );
  const selectedDebtorName = useMemo(() => {
    if (!selectedDebtorUserId) return "Medlem";
    return rankedDebtors.find((debtor) => debtor.id === selectedDebtorUserId)?.name ?? "Medlem";
  }, [rankedDebtors, selectedDebtorUserId]);

  const fineHistoryLast14Days = useMemo(
    () =>
      [...historyFines].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [historyFines]
  );

  async function handleCreateTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (createTemplateSubmitting) return;
    const parsedAmount = parseIntegerAmountInput(templateAmount);
    if (!parsedAmount.ok || parsedAmount.value === 0) {
      pushToast("Ugyldigt beløb (heltal, ikke 0)", "error");
      return;
    }
    setCreateTemplateSubmitting(true);

    try {
      const response = await fetch("/api/fine-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          title: templateTitle,
          amount: parsedAmount.value,
          category: templateCategory,
          description: templateDescription || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke oprette bødeskabelon", "error");
        return;
      }

      pushToast("Bødeskabelon oprettet", "success");
      setTemplateTitle("");
      setTemplateAmount("20");
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
        teamId
      };

      if (selectedTemplateId) {
        payloadBase.templateId = selectedTemplateId;
      } else {
        const parsedFine = parseIntegerAmountInput(fineAmount);
        if (!parsedFine.ok || parsedFine.value === 0) {
          pushToast("Ugyldigt beløb (heltal, ikke 0 — negativt tilladt som kredit)", "error");
          return;
        }
        payloadBase.amount = parsedFine.value;
        payloadBase.title = fineTitle;
        payloadBase.description = fineDescription || undefined;
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
      setMemberSearch("");
      setSelectedTemplateId("");
      setFineAmount("50");
      setFineTitle("");
      setFineDescription("");
      await refreshFinesAndApprovals();
    } finally {
      setAssignFineSubmitting(false);
    }
  }

  async function refreshFinesAndApprovals() {
    if (!teamId || !userId) return;
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const tasks: Promise<Response>[] = [
      fetch(`/api/fines?teamId=${teamId}&userId=${userId}`, { cache: "no-store" }),
      fetch(`/api/fines/debtors?teamId=${teamId}`, { cache: "no-store" }),
      fetch(`/api/fines?teamId=${teamId}&since=${encodeURIComponent(since)}`, { cache: "no-store" }),
      fetch(`/api/fines?teamId=${teamId}&createdById=${userId}`, { cache: "no-store" })
    ];
    if (canManageFines) {
      tasks.push(fetch(`/api/fines?teamId=${teamId}&status=FORESLAET`, { cache: "no-store" }));
    }
    if (isAdmin) {
      tasks.push(fetch(`/api/fines/payments/pending?teamId=${teamId}`, { cache: "no-store" }));
    }
    if (selectedDebtorUserId) {
      tasks.push(
        fetch(`/api/fines?teamId=${teamId}&userId=${selectedDebtorUserId}`, { cache: "no-store" })
      );
    }

    const responses = await Promise.all(tasks);
    let offset = 0;
    const mineResponse = responses[offset++];
    const debtorsResponse = responses[offset++];
    const historyResponse = responses[offset++];
    const mySubmittedResponse = responses[offset++];
    const managementResponse = canManageFines ? responses[offset++] : null;
    const pendingResponse = isAdmin ? responses[offset++] : null;
    const selectedDebtorResponse = selectedDebtorUserId ? responses[offset++] : null;

    if (mineResponse.ok) {
      const mineData = await mineResponse.json();
      setFines(mineData.fines ?? []);
    }
    if (debtorsResponse.ok) {
      const debtorsData = await debtorsResponse.json();
      setDebtorTotals(debtorsData.debtors ?? []);
    }
    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      setHistoryFines(historyData.fines ?? []);
    }
    if (mySubmittedResponse.ok) {
      const mySubmittedData = await mySubmittedResponse.json();
      setMySubmittedFines(mySubmittedData.fines ?? []);
    }
    if (managementResponse?.ok) {
      const managementData = await managementResponse.json();
      setManagementFines(managementData.fines ?? []);
    }
    if (isAdmin && pendingResponse?.ok) {
      const pendingData = await pendingResponse.json();
      setPendingPayments(pendingData.payments ?? []);
    }
    if (selectedDebtorResponse?.ok) {
      const selectedDebtorData = await selectedDebtorResponse.json();
      setSelectedDebtorFines(selectedDebtorData.fines ?? []);
    }
  }

  async function approveFine(id: string) {
    if (pendingFineAction) return;
    setPendingFineAction({ fineId: id, action: "approve" });
    try {
      const response = await fetch(`/api/fines/${id}/approve`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke godkende bøde", "error");
        return;
      }
      pushToast("Bøde godkendt", "success");
      await refreshFinesAndApprovals();
    } finally {
      setPendingFineAction(null);
    }
  }

  async function rejectFine(id: string) {
    if (pendingFineAction) return;
    setPendingFineAction({ fineId: id, action: "reject" });
    try {
      const response = await fetch(`/api/fines/${id}/reject`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke afvise bøde", "error");
        return;
      }
      pushToast("Bøde afvist", "success");
      await refreshFinesAndApprovals();
    } finally {
      setPendingFineAction(null);
    }
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
    if (pendingTemplateAction) return;
    setPendingTemplateAction({ templateId: id, action: "approve" });
    try {
      const response = await fetch(`/api/fine-templates/${id}/approve`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke godkende skabelon", "error");
        return;
      }
      setTemplates((prev) => prev.map((item) => (item.id === id ? data.template : item)));
      pushToast("Skabelon godkendt", "success");
    } finally {
      setPendingTemplateAction(null);
    }
  }

  async function rejectTemplate(id: string) {
    if (pendingTemplateAction) return;
    setPendingTemplateAction({ templateId: id, action: "reject" });
    try {
      const response = await fetch(`/api/fine-templates/${id}/reject`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke afvise skabelon", "error");
        return;
      }
      setTemplates((prev) => prev.map((item) => (item.id === id ? data.template : item)));
      pushToast("Skabelon afvist", "success");
    } finally {
      setPendingTemplateAction(null);
    }
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
    if (pendingPaymentAction) return;
    setPendingPaymentAction({ userId: userIdToApprove, action: "approve" });
    try {
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
    } finally {
      setPendingPaymentAction(null);
    }
  }

  async function rejectPayment(userIdToReject: string) {
    if (!teamId) return;
    if (pendingPaymentAction) return;
    setPendingPaymentAction({ userId: userIdToReject, action: "reject" });
    try {
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
    } finally {
      setPendingPaymentAction(null);
    }
  }

  async function copyMobilePayBox() {
    if (!teamMobilePayBox) return;
    if (copySubmitting) return;
    setCopySubmitting(true);
    try {
      await navigator.clipboard.writeText(teamMobilePayBox);
      pushToast("MobilePay box kopieret", "success");
    } catch {
      pushToast("Kunne ikke kopiere box-nummer", "error");
    } finally {
      setCopySubmitting(false);
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

  const pendingFines = managementFines;
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
      rightLabel: formatFineKr(template.amount),
      searchLabel: `${categoryLabel[template.category] ?? template.category} ${template.title} ${template.amount} ${
        template.description ?? ""
      }`
    }));
  const collectionTemplateOptions = approvedTemplates.map((template) => ({
    value: template.id,
    label: `${template.title} (${formatFineKr(template.amount)})`
  }));

  const myFineRequests = mySubmittedFines
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
        description: fine.description ?? null,
        recipientLabel: fine.user?.name ? `Tildelt til ${fine.user.name}` : null,
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
        description: template.description ?? null,
        recipientLabel: null,
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
    setEditAmount(String(template.amount));
    setEditCategory(template.category ?? "SPILLER");
    setEditDescription(template.description ?? "");
    setShowEditModal(true);
  }

  async function handleUpdateTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (!editingTemplate) return;
    if (updateTemplateSubmitting || deleteTemplateSubmitting) return;
    const parsedEdit = parseIntegerAmountInput(editAmount);
    if (!parsedEdit.ok) {
      pushToast("Ugyldigt beløb (heltal)", "error");
      return;
    }
    setUpdateTemplateSubmitting(true);
    try {
      const response = await fetch(`/api/fine-templates/${editingTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          amount: parsedEdit.value,
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
    } finally {
      setUpdateTemplateSubmitting(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!editingTemplate) return;
    if (deleteTemplateSubmitting || updateTemplateSubmitting) return;
    setDeleteTemplateSubmitting(true);
    try {
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
    } finally {
      setDeleteTemplateSubmitting(false);
    }
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

  const assignLabel = canManageFines ? "Tildel bøde" : "Foreslå bøde";
  const openCollectionModal = () => {
    if (!collectionDeadline) {
      const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const local = new Date(nextDay.getTime() - nextDay.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setCollectionDeadline(local);
    }
    setShowCollectionModal(true);
  };

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-ink/10 bg-fog/95 px-3 py-1.5 pt-[max(0.35rem,env(safe-area-inset-top,0px))] pb-1.5 shadow-md backdrop-blur-lg lg:hidden">
        <div className="mx-auto w-full max-w-lg">
          <button type="button" className="btn-primary w-full shadow-[0_10px_28px_-14px_rgba(0,0,0,0.35)]" onClick={() => setShowAssignModal(true)}>
            {assignLabel}
          </button>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex flex-col gap-2 lg:contents">
          <div className="shrink-0 lg:hidden" aria-hidden style={{ height: "3.65rem" }} />
          <header className="card">
            <h2 className="text-2xl font-semibold text-ink">Bøder</h2>
            <p className="mt-2 text-ink/70">Overblik over bøder og skabeloner.</p>
          </header>
        </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
        <button type="button" className="btn-primary hidden lg:inline-flex" onClick={() => setShowAssignModal(true)}>
          {assignLabel}
        </button>
        {unpaidTotal > 0 || canManageFines ? (
          <div className="flex w-full gap-2 lg:w-auto lg:gap-4">
            {unpaidTotal > 0 ? (
              <button type="button" className="btn-ghost min-h-[2.75rem] min-w-0 flex-1 lg:min-h-0 lg:flex-none" onClick={() => setShowPayModal(true)}>
                Betal bøder
              </button>
            ) : null}
            {canManageFines ? (
              <button type="button" className="btn-ghost min-h-[2.75rem] min-w-0 flex-1 lg:min-h-0 lg:flex-none" onClick={openCollectionModal}>
                Indsaml bøder
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 lg:gap-4">
          {canManageFines ? (
            <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">Bødekasseformand</span>
          ) : null}
          {hasPendingPayment ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Betaling afventer godkendelse
            </span>
          ) : null}
        </div>
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
                    {fine.description ? <p className="text-xs text-ink/65">{fine.description}</p> : null}
                    <p className="text-xs text-ink/60">
                      {new Date(fine.createdAt).toLocaleDateString("da-DK")} · {creatorLabel(fine)}
                    </p>
                    {fine.event ? <FineEventLink event={fine.event} /> : null}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${fineAmountClass(fine.amount)}`}>
                      {formatFineKr(fine.amount)}
                    </p>
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
                  <LoadingButton
                    type="button"
                    className="btn-ghost"
                    onClick={() => approvePayment(payment.userId)}
                    isLoading={pendingPaymentAction?.userId === payment.userId && pendingPaymentAction.action === "approve"}
                    disabled={pendingPaymentAction?.userId === payment.userId && pendingPaymentAction.action === "reject"}
                    idleContent="Godkend"
                    loadingContent="Godkender..."
                  />
                  <LoadingButton
                    type="button"
                    className="btn-ghost"
                    onClick={() => rejectPayment(payment.userId)}
                    isLoading={pendingPaymentAction?.userId === payment.userId && pendingPaymentAction.action === "reject"}
                    disabled={pendingPaymentAction?.userId === payment.userId && pendingPaymentAction.action === "approve"}
                    idleContent="Afvis"
                    loadingContent="Afviser..."
                  />
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
                    {fine.event ? <FineEventLink event={fine.event} /> : null}
                  </div>
                  <div className={`text-sm font-semibold ${fineAmountClass(fine.amount)}`}>
                    {formatFineKr(fine.amount)}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <LoadingButton
                    className="btn-ghost"
                    onClick={() => approveFine(fine.id)}
                    isLoading={pendingFineAction?.fineId === fine.id && pendingFineAction.action === "approve"}
                    disabled={pendingFineAction?.fineId === fine.id && pendingFineAction.action === "reject"}
                    idleContent="Godkend"
                    loadingContent="Godkender..."
                  />
                  <LoadingButton
                    className="btn-ghost"
                    onClick={() => rejectFine(fine.id)}
                    isLoading={pendingFineAction?.fineId === fine.id && pendingFineAction.action === "reject"}
                    disabled={pendingFineAction?.fineId === fine.id && pendingFineAction.action === "approve"}
                    idleContent="Afvis"
                    loadingContent="Afviser..."
                  />
                  {canDeleteFine(fine.status) ? (
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => deleteFine(fine.id)}
                      aria-label="Slet bøde"
                      title="Slet bøde"
                      disabled={deletingFineId === fine.id || pendingFineAction?.fineId === fine.id}
                    >
                      {deletingFineId === fine.id ? (
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600"
                          aria-hidden="true"
                        />
                      ) : (
                        <TrashIcon />
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
                      {requestItem.description ? (
                        <p className="text-xs text-ink/65">{requestItem.description}</p>
                      ) : null}
                      <p className="text-xs text-ink/60">
                        {requestItem.kindLabel} · {new Date(requestItem.createdAt).toLocaleDateString("da-DK")}
                      </p>
                      {requestItem.recipientLabel ? (
                        <p className="text-xs text-ink/60">{requestItem.recipientLabel}</p>
                      ) : null}
                      {requestItem.actorLabel ? (
                        <p className="text-xs text-ink/60">{requestItem.actorLabel}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${fineAmountClass(requestItem.amount)}`}>
                        {formatFineKr(requestItem.amount)}
                      </div>
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
        description="Samlet bødebeløb pr. medlem."
        storageKey={`holdbold:boder:${teamId}:${userId}:top-skyldnere`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/60">
              {rankedDebtors.length} medlemmer
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
                <th className="px-4 py-3">Medlem</th>
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
        headerEnd={
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/20 bg-white/80 text-lg font-semibold leading-none text-ink transition hover:border-ink/35 hover:bg-white"
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
            <p className="text-xs font-medium text-ink/70">Aktive indsamlingsflows</p>
            <div className="space-y-2">
              {collections.map((collection) => (
                <div key={collection.id} className="rounded-2xl border border-ink/10 bg-white/80 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{collection.template.title}</p>
                  <p className="text-xs text-ink/60">
                    Fra {new Date(collection.deadlineAt).toLocaleString("da-DK")} · hver {collection.intervalHours}. time ·{" "}
                    {formatFineKr(collection.template.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-ink/70" htmlFor="template-search">Søg i skabeloner</label>
          <input
            id="template-search"
            value={templateSearch}
            onChange={(event) => setTemplateSearch(event.target.value)}
            placeholder="Søg på titel eller beskrivelse..."
            className="input text-[14px] sm:text-[15px]"
          />
        </div>

        {canManageFines && pendingTemplates.length > 0 ? (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-medium text-ink/70">Afventer godkendelse (skabeloner)</p>
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
                  <div className={`text-sm font-semibold ${fineAmountClass(template.amount)}`}>
                    {formatFineKr(template.amount)}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <LoadingButton
                    className="btn-ghost"
                    onClick={() => approveTemplate(template.id)}
                    isLoading={pendingTemplateAction?.templateId === template.id && pendingTemplateAction.action === "approve"}
                    disabled={pendingTemplateAction?.templateId === template.id && pendingTemplateAction.action === "reject"}
                    idleContent="Godkend"
                    loadingContent="Godkender..."
                  />
                  <LoadingButton
                    className="btn-ghost"
                    onClick={() => rejectTemplate(template.id)}
                    isLoading={pendingTemplateAction?.templateId === template.id && pendingTemplateAction.action === "reject"}
                    disabled={pendingTemplateAction?.templateId === template.id && pendingTemplateAction.action === "approve"}
                    idleContent="Afvis"
                    loadingContent="Afviser..."
                  />
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
                  <div className={`text-sm font-semibold ${fineAmountClass(template.amount)}`}>
                    {formatFineKr(template.amount)}
                  </div>
                </div>
                {canManageFines ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
                    <button
                      type="button"
                      className="btn-ghost w-full justify-center sm:w-auto"
                      onClick={() => openEditTemplate(template)}
                    >
                      Rediger
                    </button>
                    <button
                      type="button"
                      className="btn-primary w-full justify-center sm:w-auto"
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

      <CollapsibleCard
        title="Historik"
        description="Seneste 14 dages bøder."
        storageKey={`holdbold:boder:${teamId}:${userId}:historik`}
        right={
          fineHistoryLast14Days.length > 0 ? (
            <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/60">
              {fineHistoryLast14Days.length} registreringer
            </span>
          ) : null
        }
      >
        {fineHistoryLast14Days.length === 0 ? (
          <p className="text-sm text-ink/60">Ingen bøder de seneste 14 dage.</p>
        ) : (
          <div className="space-y-3">
            {fineHistoryLast14Days.map((fine) => {
              const status = fineStatusMeta(fine.status);
              const proposedBy = creatorLabel(fine);
              const approverName =
                fine.approvedBy?.name ?? (fine.approvedById ? memberNameById.get(fine.approvedById) : null);
              const rejectedByName = fine.rejectedById ? memberNameById.get(fine.rejectedById) : null;
              return (
                <div key={fine.id} className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{fine.reason}</p>
                      {fine.description ? <p className="mt-0.5 text-xs text-ink/60">{fine.description}</p> : null}
                      <ul className="mt-2 space-y-1 text-xs text-ink/70">
                        <li>
                          <span className="font-medium text-ink/80">Modtager:</span> {fine.user?.name ?? "—"}
                        </li>
                        <li>
                          <span className="font-medium text-ink/80">Foreslået af:</span> {proposedBy}
                        </li>
                        {fine.status === "FORESLAET" ? (
                          <li>
                            <span className="font-medium text-ink/80">Godkendt af:</span> Afventer
                          </li>
                        ) : fine.status === "AFVIST" ? (
                          <li>
                            <span className="font-medium text-ink/80">Afvist af:</span> {rejectedByName ?? "Ukendt"}
                          </li>
                        ) : (
                          <li>
                            <span className="font-medium text-ink/80">Godkendt af:</span> {approverName ?? "—"}
                          </li>
                        )}
                      </ul>
                      {fine.event ? <FineEventLink event={fine.event} /> : null}
                      <p className="mt-2 text-xs text-ink/55">
                        {new Date(fine.createdAt).toLocaleString("da-DK", {
                          dateStyle: "short",
                          timeStyle: "short"
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={`text-sm font-semibold ${fineAmountClass(fine.amount)}`}>
                        {formatFineKr(fine.amount)}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                    disabled={!teamMobilePayBox || copySubmitting}
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
                      {copySubmitting ? "Kopierer..." : "Kopiér"}
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
              <LoadingButton
                type="button"
                className="btn-primary"
                onClick={handleRequestPaymentApproval}
                disabled={unpaidTotal <= 0 || !teamMobilePayBox}
                isLoading={paySubmitting}
                idleContent="Jeg har betalt mine bøder"
                loadingContent="Sender..."
              />
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
                <label className="text-xs font-medium text-ink/70" htmlFor="collection-template">Bødeskabelon</label>
                <select
                  id="collection-template"
                  className="input text-[14px] sm:text-[15px]"
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
                <label className="text-xs font-medium text-ink/70" htmlFor="collection-deadline">Deadline</label>
                <input
                  id="collection-deadline"
                  type="datetime-local"
                  className="input text-[14px] sm:text-[15px]"
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
                <p className="mt-2 text-sm text-ink/70">Alle registrerede bøder for medlemmet.</p>
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
                        {fine.description ? <p className="text-xs text-ink/65">{fine.description}</p> : null}
                        <p className="text-xs text-ink/60">
                          {new Date(fine.createdAt).toLocaleString("da-DK")} · {creatorLabel(fine)}
                        </p>
                        {fine.event ? <FineEventLink event={fine.event} /> : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <p
                          className={`text-sm font-semibold whitespace-nowrap ${fineAmountClass(fine.amount)}`}
                        >
                          {formatFineKr(fine.amount)}
                        </p>
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
                              <TrashIcon />
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
                <label className="text-xs font-medium text-ink/70" htmlFor="template-title">Titel</label>
                <input
                  id="template-title"
                  value={templateTitle}
                  onChange={(event) => setTemplateTitle(event.target.value)}
                  placeholder="Titel"
                  className="input text-[14px] sm:text-[15px]"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink/70" htmlFor="template-amount">Beløb</label>
                <input
                  id="template-amount"
                  type="text"
                  inputMode="numeric"
                  value={templateAmount}
                  onChange={(event) => setTemplateAmount(event.target.value)}
                  placeholder="Beløb (fx 20 eller -10)"
                  className="input text-[14px] sm:text-[15px]"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium text-ink/70" htmlFor="template-category">Kategori</label>
                <select
                  id="template-category"
                  value={templateCategory}
                  onChange={(event) =>
                    setTemplateCategory(event.target.value as "SOME" | "FAELLES" | "SPILLER" | "DIVERSE")
                  }
                  className="input text-[14px] sm:text-[15px]"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium text-ink/70" htmlFor="template-desc">Beskrivelse</label>
                <input
                  id="template-desc"
                  value={templateDescription}
                  onChange={(event) => setTemplateDescription(event.target.value)}
                  placeholder="Beskrivelse (valgfri)"
                  className="input text-[14px] sm:text-[15px]"
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
            setFineAmount("50");
            setFineTitle("");
            setFineDescription("");
          }}
        >
          <div
            className="modal-panel assign-panel max-w-lg flex min-h-0 flex-col sm:max-h-[min(88vh,860px)] sm:overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  {canManageFines ? "Tildel bøde" : "Foreslå bøde"}
                </h3>
                <p className="mt-2 text-sm text-ink/70">Vælg modtager og bødeskabelon.</p>
              </div>
              <button
                className="btn-ghost shrink-0"
                onClick={() => {
                  if (assignFineSubmitting) return;
                  setShowAssignModal(false);
                  setSelectedUserIds([]);
                  setMemberSearch("");
                  setSelectedTemplateId("");
                  setFineAmount("50");
                  setFineTitle("");
                  setFineDescription("");
                }}
                disabled={assignFineSubmitting}
              >
                Luk
              </button>
            </div>
            <form onSubmit={handleCreateFine} className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col gap-0 sm:block sm:flex-none">
              <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain pb-3 sm:max-h-none sm:overflow-visible sm:pb-0">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-ink/70">Modtagere</label>
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Søg spiller..."
                    className="input text-[14px] sm:text-[15px]"
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
                          selectedUserIds.length === 0 ? "bg-ink text-fog" : "text-ink/70 hover:bg-ink/5"
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
                  <div className="max-h-[min(32dvh,220px)] space-y-2 overflow-y-auto rounded-2xl border border-ink/10 bg-white/80 p-3 sm:max-h-[34vh]">
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
                  <label className="text-xs font-medium text-ink/70">Skabelon</label>
                  <Combobox
                    value={selectedTemplateId}
                    onChange={setSelectedTemplateId}
                    options={templateOptions}
                    placeholder="Vælg skabelon (valgfri)"
                    searchPlaceholder="Søg skabelon..."
                    emptyLabel="Ingen skabeloner matcher"
                    className="text-[14px] sm:text-[15px]"
                  />
                </div>
                {!selectedTemplateId ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-ink/70" htmlFor="fine-amount">
                        Beløb
                      </label>
                      <input
                        id="fine-amount"
                        type="text"
                        inputMode="numeric"
                        value={fineAmount}
                        onChange={(event) => setFineAmount(event.target.value)}
                        placeholder="Beløb (heltal, negativt = kredit)"
                        className="input text-[14px] sm:text-[15px]"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-ink/70" htmlFor="fine-title">
                        Titel
                      </label>
                      <input
                        id="fine-title"
                        value={fineTitle}
                        onChange={(event) => setFineTitle(event.target.value)}
                        placeholder="Titel"
                        className="input text-[14px] sm:text-[15px]"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-ink/70" htmlFor="fine-description">
                        Beskrivelse
                      </label>
                      <input
                        id="fine-description"
                        value={fineDescription}
                        onChange={(event) => setFineDescription(event.target.value)}
                        placeholder="Beskrivelse (valgfri)"
                        className="input text-[14px] sm:text-[15px]"
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <div className="shrink-0 border-t border-ink/10 bg-fog/95 pt-3  sm:border-0 sm:bg-transparent sm:pb-0 sm:pt-4">
                <button type="submit" className="btn-primary w-full" disabled={assignFineSubmitting}>
                  {assignFineSubmitting
                    ? "Gemmer..."
                    : canManageFines
                      ? "Tildel bøde"
                      : "Foreslå bøde"}
                </button>
              </div>
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
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleDeleteTemplate}
                  aria-label="Slet skabelon"
                  title="Slet skabelon"
                  disabled={deleteTemplateSubmitting || updateTemplateSubmitting}
                >
                  {deleteTemplateSubmitting ? (
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <TrashIcon />
                  )}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setShowEditModal(false)}
                  disabled={updateTemplateSubmitting || deleteTemplateSubmitting}
                >
                  Luk
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateTemplate} className="mt-4 grid gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink/70" htmlFor="edit-title">Titel</label>
                <input
                  id="edit-title"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="input text-[14px] sm:text-[15px]"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink/70" htmlFor="edit-amount">Beløb</label>
                <input
                  id="edit-amount"
                  type="text"
                  inputMode="numeric"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                  className="input text-[14px] sm:text-[15px]"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink/70" htmlFor="edit-category">Kategori</label>
                <select
                  id="edit-category"
                  value={editCategory}
                  onChange={(event) =>
                    setEditCategory(event.target.value as "SOME" | "FAELLES" | "SPILLER" | "DIVERSE")
                  }
                  className="input text-[14px] sm:text-[15px]"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink/70" htmlFor="edit-desc">Beskrivelse</label>
                <input
                  id="edit-desc"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  className="input text-[14px] sm:text-[15px]"
                />
              </div>
              <LoadingButton
                className="btn-primary"
                isLoading={updateTemplateSubmitting}
                disabled={deleteTemplateSubmitting}
                idleContent="Gem ændringer"
                loadingContent="Gemmer..."
              />
            </form>
          </div>
        </div>
      ) : null}
    </section>
    </>
  );
}
