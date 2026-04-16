"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { setCustomTheme, setTheme } from "@/components/ThemeProvider";
import { getStoredTeamId, setStoredTeamId } from "@/components/appState";
import { useToast } from "@/components/ToastProvider";
import PushSettings from "@/components/PushSettings";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import LoadingButton from "@/components/LoadingButton";
import { invalidateDashboardTeam } from "@/components/DashboardTeamProvider";
import { clearMeClientCache } from "@/lib/meClientCache";
import {
  fetchFineAutomationCached,
  primeFineAutomationCache
} from "@/lib/fineAutomationClientCache";

type Membership = {
  role: string;
  team: { id: string; name: string; slug: string };
};

type TeamMember = {
  id: string;
  role: string;
  status: "PENDING" | "ACTIVE";
  user: {
    id: string;
    name: string;
    email?: string | null;
    image?: string | null;
  };
};

type IcalFeed = {
  id: string;
  name: string;
  url: string;
  lastImportedAt?: string | null;
};

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  TRAENER: "Træner",
  SPILLER: "Spiller",
  SOME: "SoMe",
  BOEDEKASSEFORMAND: "Bødekasseformand"
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Aktiv",
  PENDING: "Afventer"
};

const FINE_AUTOMATION_ACTIONS = [
  {
    action: "MISSED_SIGNUP_AT_DEADLINE" as const,
    label: "Manglende svar ved/efter deadline",
    hint: "Gælder spillere uden svar efter tilmeldingsfrist."
  },
  {
    action: "STATUS_CHANGE_AFTER_DEADLINE" as const,
    label: "Ændring af status efter deadline",
    hint: "Når nogen sætter svar efter fristen er passeret."
  },
  {
    action: "SAME_DAY_WITHDRAWAL" as const,
    label: "Afbud på begivenhedsdag",
    hint: "Når nogen melder fra på begivenhedens dag."
  }
] as const;

const FINE_AUTOMATION_ROLE_KEYS = ["ADMIN", "TRAENER", "SPILLER", "SOME", "BOEDEKASSEFORMAND"] as const;

type FineAutomationRuleDraft = {
  appliesTraining: boolean;
  appliesMatch: boolean;
  templateTrainingId: string;
  templateMatchId: string;
  excludedRoles: string[];
};

function emptyFineAutomationRuleDraft(): FineAutomationRuleDraft {
  return {
    appliesTraining: false,
    appliesMatch: false,
    templateTrainingId: "",
    templateMatchId: "",
    excludedRoles: ["SOME"]
  };
}

const presets = [
  { id: "atlantic", label: "Atlantic" },
  { id: "sandstone", label: "Sandstone" },
  { id: "forest", label: "Forest" },
  { id: "midnight", label: "Midnight" },
  { id: "mono", label: "Mono" },
  { id: "bk", label: "BK" },
  { id: "crimson", label: "Crimson" },
  { id: "ocean", label: "Ocean" },
  { id: "lavender", label: "Lavender" },
  { id: "sunset", label: "Sunset" },
  { id: "citrus", label: "Citrus" },
  { id: "neon", label: "Neon" },
  { id: "custom", label: "Tilpasset" }
];

export default function IndstillingerPage() {
  const { pushToast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [active, setActive] = useState("atlantic");
  const [hasUserTheme, setHasUserTheme] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberRole, setMemberRole] = useState("SPILLER");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mobilePayBox, setMobilePayBox] = useState("");
  const [savingMobilePayBox, setSavingMobilePayBox] = useState(false);
  const [savingTeamTheme, setSavingTeamTheme] = useState(false);
  const [customTheme, setCustomThemeState] = useState({
    ink: "#0f172a",
    clay: "#cbd5e1",
    moss: "#0f766e",
    ember: "#d97706",
    fog: "#f8fafc",
    button: "#0f172a",
    buttonText: "#f8fafc",
    gradientStart: "#f8fafc",
    gradientMid: "#eef2f7",
    gradientEnd: "#e2e8f0"
  });
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [icalUrl, setIcalUrl] = useState("");
  const [icalImporting, setIcalImporting] = useState(false);
  const [xlsxImporting, setXlsxImporting] = useState(false);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [icalFeeds, setIcalFeeds] = useState<IcalFeed[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [copyingInviteLink, setCopyingInviteLink] = useState(false);
  const [savingCustomTheme, setSavingCustomTheme] = useState(false);
  const [usingTeamTheme, setUsingTeamTheme] = useState(false);
  const [themeApplyingId, setThemeApplyingId] = useState<string | null>(null);
  const [memberActionSubmitting, setMemberActionSubmitting] = useState<"approve" | "updateRole" | "delete" | null>(null);
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState(false);
  const [fineAutomationTemplates, setFineAutomationTemplates] = useState<
    Array<{ id: string; title: string; amount: number; category: string }>
  >([]);
  const [fineAutomationRules, setFineAutomationRules] = useState<
    Record<string, FineAutomationRuleDraft>
  >({});
  const [fineAutomationLoading, setFineAutomationLoading] = useState(false);
  const [fineAutomationSaving, setFineAutomationSaving] = useState(false);

  useEffect(() => {
    setTeamId(getStoredTeamId());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("notice") === "pending_approval") {
      setPendingApprovalNotice(true);
    }
  }, []);

  useEffect(() => {
    async function loadMembershipsAndTheme() {
      if (!session?.user?.id) return;
      const response = await fetch("/api/me");
      if (!response.ok) return;
      const data = await response.json();
      const list = data.memberships ?? [];
      setMemberships(list);
      if (data.user) {
        setProfileName(data.user.name ?? "");
        setProfileEmail(data.user.email ?? "");
        setProfileImage(data.user.image ?? "");
      }

      let resolvedTeamId = teamId;
      if (list.length > 0) {
        const isCurrentValid = list.some((membership: Membership) => membership.team.id === teamId);
        if (!teamId || !isCurrentValid) {
          resolvedTeamId = list[0].team.id;
          setTeamId(resolvedTeamId);
          setStoredTeamId(resolvedTeamId);
        }
      }

      const userTheme = data.user?.themePreset ?? null;
      const userHasTheme = Boolean(userTheme);
      if (userHasTheme) {
        setHasUserTheme(true);
        setActive(userTheme);
        if (userTheme === "custom") {
          const config = data.user?.themeConfig ?? customTheme;
          setCustomThemeState((prev) => ({ ...prev, ...config }));
          setCustomTheme(config ?? customTheme);
        } else {
          setTheme(userTheme);
        }
      } else {
        setHasUserTheme(false);
      }
      if (!resolvedTeamId) return;
      const teamResponse = await fetch(`/api/team/${resolvedTeamId}`);
      if (!teamResponse.ok) return;
      const teamData = await teamResponse.json();
      setMobilePayBox(teamData.team?.mobilePayBox ?? "");
      if (!userHasTheme) {
        const teamTheme = teamData.team?.themePreset ?? "atlantic";
        setActive(teamTheme);
        if (teamTheme === "custom") {
          const config = teamData.team?.themeConfig ?? customTheme;
          setCustomThemeState((prev) => ({ ...prev, ...config }));
          setCustomTheme(config ?? customTheme);
        } else {
          setTheme(teamTheme);
        }
      }
    }

    loadMembershipsAndTheme();
  }, [session?.user?.id, teamId]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (session.user.hasActiveMembership) return;
    if (!session.user.hasPendingMembership) return;

    const interval = window.setInterval(async () => {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const list = data.memberships ?? [];
      if (!Array.isArray(list) || list.length === 0) return;

      setMemberships(list);
      const firstTeamId = list[0]?.team?.id ?? "";
      if (!firstTeamId) return;
      setTeamId(firstTeamId);
      setStoredTeamId(firstTeamId);
      invalidateDashboardTeam();
      pushToast("Du er blevet godkendt og sat på holdet automatisk.", "success");
      window.clearInterval(interval);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [pushToast, session?.user?.hasActiveMembership, session?.user?.hasPendingMembership, session?.user?.id]);

  useEffect(() => {
    async function loadTeamMembers() {
      if (!teamId) return;
      const response = await fetch(`/api/team-members?teamId=${teamId}&includePending=true`);
      if (!response.ok) return;
      const data = await response.json();
      setTeamMembers(data.members ?? []);
    }

    loadTeamMembers();
  }, [teamId]);

  useEffect(() => {
    async function loadIcalFeeds() {
      if (!teamId) return;
      const response = await fetch(`/api/ical/import?teamId=${teamId}`, { cache: "no-store" });
      if (!response.ok) {
        setIcalFeeds([]);
        return;
      }
      const data = await response.json();
      setIcalFeeds(data.feeds ?? []);
    }

    loadIcalFeeds();
  }, [teamId]);

  useEffect(() => {
    const membership = memberships.find((item) => item.team.id === teamId);
    const canFine =
      membership?.role === "ADMIN" || membership?.role === "BOEDEKASSEFORMAND";
    if (!teamId || !canFine) return;

    let cancelled = false;
    (async () => {
      setFineAutomationLoading(true);
      try {
        const result = await fetchFineAutomationCached(teamId);
        const data = result.data ?? {};
        if (!result.ok) {
          if (!cancelled) {
            pushToast(data.error ?? "Kunne ikke hente automatiske bøder", "error");
          }
          return;
        }
        const rules: Record<string, FineAutomationRuleDraft> = {};
        for (const def of FINE_AUTOMATION_ACTIONS) {
          const saved = (data.rules ?? []).find(
            (item: { action: string }) => item.action === def.action
          );
          rules[def.action] = saved
            ? {
                appliesTraining: Boolean(saved.appliesTraining),
                appliesMatch: Boolean(saved.appliesMatch),
                templateTrainingId: saved.templateTrainingId ?? "",
                templateMatchId: saved.templateMatchId ?? "",
                excludedRoles: Array.isArray(saved.excludedRoles) ? saved.excludedRoles : ["SOME"]
              }
            : emptyFineAutomationRuleDraft();
        }
        if (!cancelled) {
          setFineAutomationTemplates(data.templates ?? []);
          setFineAutomationRules(rules);
        }
      } finally {
        if (!cancelled) {
          setFineAutomationLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamId, memberships, pushToast]);

  async function handleTheme(theme: string) {
    if (themeApplyingId) return;
    setThemeApplyingId(theme);
    setActive(theme);
    setHasUserTheme(true);
    if (theme === "custom") {
      setCustomTheme(customTheme);
    } else {
      setTheme(theme);
    }
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themePreset: theme,
          ...(theme === "custom" ? { themeConfig: customTheme } : {})
        })
      });
      if (response.ok) clearMeClientCache();
    } catch {
      pushToast("Kunne ikke gemme tema", "error");
    } finally {
      setThemeApplyingId(null);
    }
  }

  async function handleSaveCustomTheme() {
    if (savingCustomTheme) return;
    setSavingCustomTheme(true);
    setHasUserTheme(true);
    setCustomTheme(customTheme);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: "custom", themeConfig: customTheme })
      });
      if (response.ok) clearMeClientCache();
    } finally {
      setSavingCustomTheme(false);
    }
  }

  async function handleUseTeamTheme() {
    if (usingTeamTheme) return;
    setUsingTeamTheme(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: null, themeConfig: null })
      });
      if (!response.ok) {
        pushToast("Kunne ikke skifte til holdets tema", "error");
        return;
      }
      clearMeClientCache();
      setHasUserTheme(false);
      if (!teamId) return;
      const teamResponse = await fetch(`/api/team/${teamId}`);
      if (!teamResponse.ok) return;
      const data = await teamResponse.json();
      setMobilePayBox(data.team?.mobilePayBox ?? "");
      const theme = data.team?.themePreset ?? "atlantic";
      setActive(theme);
      if (theme === "custom") {
        const config = data.team?.themeConfig ?? customTheme;
        setCustomThemeState((prev) => ({ ...prev, ...config }));
        setCustomTheme(config ?? customTheme);
      } else {
        setTheme(theme);
      }
    } finally {
      setUsingTeamTheme(false);
    }
  }

  useEffect(() => {
    if (active === "custom") {
      setCustomTheme(customTheme);
    }
  }, [active, customTheme]);

  useEffect(() => {
    if (active !== "custom" || !hasUserTheme) return;
    const timeout = setTimeout(() => {
      fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreset: "custom", themeConfig: customTheme })
      })
        .then((r) => {
          if (r.ok) clearMeClientCache();
        })
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timeout);
  }, [active, customTheme, hasUserTheme]);

  function handleTeamChange(value: string) {
    setTeamId(value);
    setStoredTeamId(value);
  }

  async function handleSaveMobilePayBox() {
    if (!teamId) return;
    setSavingMobilePayBox(true);
    try {
      const response = await fetch(`/api/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobilePayBox: mobilePayBox.trim() || null })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme MobilePay box", "error");
        return;
      }
      pushToast("MobilePay box gemt", "success");
    } finally {
      setSavingMobilePayBox(false);
    }
  }

  async function handleSaveTeamTheme() {
    if (!teamId || !isAdmin) return;
    setSavingTeamTheme(true);
    try {
      const response = await fetch(`/api/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themePreset: active,
          ...(active === "custom" ? { themeConfig: customTheme } : { themeConfig: null })
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme holdets tema", "error");
        return;
      }
      pushToast("Holdets standardtema er opdateret", "success");
    } finally {
      setSavingTeamTheme(false);
    }
  }

  async function handleSaveFineAutomation() {
    if (!teamId) return;
    const membership = memberships.find((item) => item.team.id === teamId);
    if (membership?.role !== "ADMIN" && membership?.role !== "BOEDEKASSEFORMAND") return;

    for (const def of FINE_AUTOMATION_ACTIONS) {
      const draft = fineAutomationRules[def.action] ?? emptyFineAutomationRuleDraft();
      if (draft.appliesTraining && !draft.templateTrainingId) {
        pushToast(`Vælg skabelon for træning: ${def.label}`, "error");
        return;
      }
      if (draft.appliesMatch && !draft.templateMatchId) {
        pushToast(`Vælg skabelon for kamp: ${def.label}`, "error");
        return;
      }
    }

    const rules = FINE_AUTOMATION_ACTIONS.map((def) => {
      const draft = fineAutomationRules[def.action] ?? emptyFineAutomationRuleDraft();
      return {
        action: def.action,
        appliesTraining: draft.appliesTraining,
        appliesMatch: draft.appliesMatch,
        templateTrainingId: draft.appliesTraining ? draft.templateTrainingId : null,
        templateMatchId: draft.appliesMatch ? draft.templateMatchId : null,
        excludedRoles: draft.excludedRoles
      };
    });

    setFineAutomationSaving(true);
    try {
      const response = await fetch(`/api/team/${teamId}/fine-automation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme automatisering", "error");
        return;
      }
      primeFineAutomationCache(teamId, data);
      pushToast("Automatiske bødeforslag gemt", "success");
      const next: Record<string, FineAutomationRuleDraft> = {};
      for (const def of FINE_AUTOMATION_ACTIONS) {
        const saved = (data.rules ?? []).find(
          (item: { action: string }) => item.action === def.action
        );
        next[def.action] = saved
          ? {
              appliesTraining: Boolean(saved.appliesTraining),
              appliesMatch: Boolean(saved.appliesMatch),
              templateTrainingId: saved.templateTrainingId ?? "",
              templateMatchId: saved.templateMatchId ?? "",
              excludedRoles: Array.isArray(saved.excludedRoles) ? saved.excludedRoles : ["SOME"]
            }
          : emptyFineAutomationRuleDraft();
      }
      setFineAutomationRules(next);
    } finally {
      setFineAutomationSaving(false);
    }
  }

  const currentMembership = memberships.find((item) => item.team.id === teamId);
  const isAdmin = currentMembership?.role === "ADMIN";
  const canManageFineAutomation =
    currentMembership?.role === "ADMIN" || currentMembership?.role === "BOEDEKASSEFORMAND";
  const inviteSlug = currentMembership?.team.slug ?? "";
  const passwordValidationMessage =
    newPassword && newPassword.length < 6
      ? "Ny adgangskode skal være mindst 6 tegn."
      : newPassword && newPassword !== confirmPassword
      ? "Adgangskoderne matcher ikke."
      : null;

  async function handleCopySignupLink() {
    if (!inviteSlug) return;
    if (copyingInviteLink) return;
    setCopyingInviteLink(true);
    const origin = window.location.origin;
    const inviteUrl = `${origin}/signup?slug=${encodeURIComponent(inviteSlug)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const temp = document.createElement("textarea");
        temp.value = inviteUrl;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      pushToast("Invitationslink kopieret", "success");
    } catch {
      pushToast("Kunne ikke kopiere linket", "error");
    } finally {
      setCopyingInviteLink(false);
    }
  }

  async function handleUpdateRole() {
    if (!selectedMember) return;
    if (memberActionSubmitting) return;
    setMemberActionSubmitting("updateRole");
    try {
      const response = await fetch(`/api/team-members/${selectedMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: memberRole })
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke opdatere rolle", "error");
        return;
      }
      setTeamMembers((prev) => prev.map((m) => (m.id === selectedMember.id ? { ...m, role: data.membership.role } : m)));
      setSelectedMember((prev) => (prev ? { ...prev, role: data.membership.role } : prev));
      invalidateDashboardTeam();
      pushToast("Rolle opdateret", "success");
    } finally {
      setMemberActionSubmitting(null);
    }
  }

  async function handleApproveMember() {
    if (!selectedMember) return;
    if (memberActionSubmitting) return;
    setMemberActionSubmitting("approve");
    try {
      const response = await fetch(`/api/team-members/${selectedMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: memberRole, status: "ACTIVE" })
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke godkende medlem", "error");
        return;
      }
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === selectedMember.id
            ? { ...m, role: data.membership.role, status: data.membership.status }
            : m
        )
      );
      setSelectedMember((prev) =>
        prev
          ? {
              ...prev,
              role: data.membership.role,
              status: data.membership.status
            }
          : prev
      );
      invalidateDashboardTeam();
      pushToast("Medlem godkendt", "success");
    } finally {
      setMemberActionSubmitting(null);
    }
  }

  async function handleDeleteMember() {
    if (!selectedMember) return;
    if (memberActionSubmitting) return;
    setMemberActionSubmitting("delete");
    try {
      const response = await fetch(`/api/team-members/${selectedMember.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke fjerne bruger", "error");
        return;
      }
      setTeamMembers((prev) => prev.filter((m) => m.id !== selectedMember.id));
      setSelectedMember(null);
      invalidateDashboardTeam();
      pushToast(data.warning ?? "Bruger fjernet", "success");
    } finally {
      setMemberActionSubmitting(null);
    }
  }

  function confirmDeleteMember() {
    if (!selectedMember) return;
    setShowDeleteConfirm(true);
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  }

  async function handleProfileSave(event: React.FormEvent) {
    event.preventDefault();
    if (profileSaving) return;
    if (newPassword && newPassword.length < 6) {
      pushToast("Ny adgangskode skal være mindst 6 tegn.", "error");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      pushToast("Adgangskoderne matcher ikke.", "error");
      return;
    }

    setProfileSaving(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail ? profileEmail.toLowerCase() : null,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke opdatere profil", "error");
        return;
      }

      pushToast("Profil opdateret.", "success");
      clearMeClientCache();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/me/avatar", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke uploade profilbillede", "error");
        return;
      }
      setProfileImage(data.url);
      clearMeClientCache();
      pushToast("Profilbillede opdateret.", "success");
    } finally {
      setUploading(false);
    }
  }

  async function handleIcalImport(event: React.FormEvent) {
    event.preventDefault();
    if (!teamId) {
      pushToast("Vælg et hold først", "error");
      return;
    }
    if (!icalUrl.trim()) {
      pushToast("Indsæt iCal URL", "error");
      return;
    }

    setIcalImporting(true);
    try {
      const response = await fetch("/api/ical/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          url: icalUrl
        })
      });
      const raw = await response.text();
      let data: { error?: string; details?: string; created?: number; updated?: number } = {};
      try {
        data = JSON.parse(raw);
      } catch {
        data = {};
      }
      if (!response.ok) {
        pushToast(data.error ?? `Import fejlede (${response.status})`, "error");
        if (!data.error) {
          console.error("iCal import non-JSON response", raw.slice(0, 500));
        } else if (data.details) {
          console.error("iCal import details", data.details);
        }
        return;
      }
      pushToast(`Importeret: ${data.created} oprettet, ${data.updated} opdateret`, "success");

      const feedsResponse = await fetch(`/api/ical/import?teamId=${teamId}`, { cache: "no-store" });
      if (feedsResponse.ok) {
        const feedsData = await feedsResponse.json();
        setIcalFeeds(feedsData.feeds ?? []);
      }
    } finally {
      setIcalImporting(false);
    }
  }

  async function handleXlsxImport(event: React.FormEvent) {
    event.preventDefault();
    if (!teamId) {
      pushToast("Vælg et hold først", "error");
      return;
    }
    if (!xlsxFile) {
      pushToast("Vælg en Excel-fil (.xlsx)", "error");
      return;
    }

    setXlsxImporting(true);
    try {
      const formData = new FormData();
      formData.append("teamId", teamId);
      formData.append("file", xlsxFile);

      const response = await fetch("/api/ical/import-xlsx", {
        method: "POST",
        body: formData
      });
      const raw = await response.text();
      let data: { error?: string; created?: number; updated?: number } = {};
      try {
        data = JSON.parse(raw);
      } catch {
        data = {};
      }
      if (!response.ok) {
        pushToast(data.error ?? `Excel-import fejlede (${response.status})`, "error");
        if (!data.error) {
          console.error("Excel import non-JSON response", raw.slice(0, 500));
        }
        return;
      }

      pushToast(`Excel importeret: ${data.created} oprettet, ${data.updated} opdateret`, "success");
      setXlsxFile(null);

      const feedsResponse = await fetch(`/api/ical/import?teamId=${teamId}`, { cache: "no-store" });
      if (feedsResponse.ok) {
        const feedsData = await feedsResponse.json();
        setIcalFeeds(feedsData.feeds ?? []);
      }
    } finally {
      setXlsxImporting(false);
    }
  }

  if (sessionStatus === "loading") {
    return (
      <section className="w-full min-w-0 space-y-6">
        <header className="card">
          <h2 className="text-2xl font-semibold text-ink">Indstillinger</h2>
          <p className="mt-2 text-ink/70">Indlæser...</p>
        </header>
      </section>
    );
  }

  if (!session?.user?.id) {
    return (
      <section className="w-full min-w-0 space-y-6">
        <header className="card">
          <h2 className="text-2xl font-semibold text-ink">Indstillinger</h2>
          <p className="mt-2 text-ink/70">Du skal være logget ind for at se indstillinger.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="w-full min-w-0 space-y-6">
      <header className="card">
        <h2 className="text-2xl font-semibold text-ink">Indstillinger</h2>
        <p className="mt-2 text-ink/70">Team, roller og integrationsindstillinger.</p>
        {pendingApprovalNotice ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            Din bruger afventer godkendelse. Du kan allerede nu aktivere push-notifikationer her i Indstillinger.
          </p>
        ) : null}
      </header>

      <CollapsibleCard
        title="Profil"
        description="Opdater dine oplysninger og adgangskode."
        storageKey={`holdbold:settings:${session.user.id}:profil`}
        headerEnd={
          <LoadingButton
            type="button"
            className="btn-ghost"
            onClick={handleSignOut}
            isLoading={signingOut}
            idleContent="Log ud"
            loadingContent="Logger ud..."
          />
        }
      >
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleProfileSave}>
          <div className="space-y-2 lg:col-span-2">
            <label className="label" htmlFor="profile-avatar">Profilbillede</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-ink/10 bg-white/80">
                {profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileImage} alt="Profilbillede" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <label
                htmlFor="profile-avatar"
                className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-4 text-sm text-ink/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:flex-1"
              >
                <span className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-fog">
                  Vælg fil
                </span>
                <span className="truncate text-ink/60">
                  {profileImage ? "Profilbillede valgt" : "Der er ikke valgt nogen fil"}
                </span>
              </label>
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={(event) => handleAvatarUpload(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>
            {uploading ? <p className="text-xs text-ink/60">Uploader...</p> : null}
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="profile-name">Navn</label>
            <input
              id="profile-name"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value.toLowerCase())}
              className="input"
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="current-password">Nuværende adgangskode</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="new-password">Ny adgangskode</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="confirm-password">Gentag ny adgangskode</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="input"
            />
            {passwordValidationMessage ? (
              <p className="text-xs font-semibold text-red-600">{passwordValidationMessage}</p>
            ) : null}
          </div>
          <div className="flex items-end gap-3">
            <LoadingButton
              type="submit"
              className="btn-primary"
              isLoading={profileSaving}
              idleContent="Gem profil"
              loadingContent="Gemmer..."
            />
          </div>
        </form>
      </CollapsibleCard>

      <CollapsibleCard title="Push-notifikationer" storageKey={`holdbold:settings:${session.user.id}:push`}>
        <PushSettings />
      </CollapsibleCard>

      {canManageFineAutomation && teamId ? (
        <CollapsibleCard
          title="Automatiske bødeforslag"
          description="Slå træning og/eller kamp til for hver — når en type er aktiv, skal du vælge en godkendt skabelon for den."
          storageKey={`holdbold:settings:${session.user.id}:fine-auto:${teamId}`}
        >
          {fineAutomationLoading ? (
            <p className="text-sm text-ink/60">Henter indstillinger…</p>
          ) : fineAutomationTemplates.length === 0 ? (
            <p className="text-sm text-ink/60">
              Opret mindst én godkendt bødeskabelon under Bøder, før automatisering kan konfigureres.
            </p>
          ) : (
            <div className="space-y-6">
              {FINE_AUTOMATION_ACTIONS.map((def) => {
                const draft = fineAutomationRules[def.action] ?? emptyFineAutomationRuleDraft();
                return (
                  <CollapsibleCard
                    key={def.action}
                    title={def.label}
                    description={def.hint}
                    storageKey={`holdbold:settings:${session.user.id}:fine-auto:${teamId}:${def.action}`}
                    className="border border-ink/10 bg-white/80"
                    surface="card-soft"
                    titleClassName="text-sm font-semibold text-ink"
                    descriptionClassName="mt-1 text-xs text-ink/60"
                  >
                    <p className="label">Begivenhedstype</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFineAutomationRules((prev) => {
                            const cur = prev[def.action] ?? emptyFineAutomationRuleDraft();
                            const nextOn = !cur.appliesTraining;
                            return {
                              ...prev,
                              [def.action]: {
                                ...cur,
                                appliesTraining: nextOn,
                                templateTrainingId: nextOn ? cur.templateTrainingId : ""
                              }
                            };
                          })
                        }
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                          draft.appliesTraining
                            ? "border-moss bg-moss/15 text-ink"
                            : "border-ink/15 bg-white/60 text-ink/70"
                        }`}
                      >
                        Træning {draft.appliesTraining ? "· til" : "· fra"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFineAutomationRules((prev) => {
                            const cur = prev[def.action] ?? emptyFineAutomationRuleDraft();
                            const nextOn = !cur.appliesMatch;
                            return {
                              ...prev,
                              [def.action]: {
                                ...cur,
                                appliesMatch: nextOn,
                                templateMatchId: nextOn ? cur.templateMatchId : ""
                              }
                            };
                          })
                        }
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                          draft.appliesMatch
                            ? "border-moss bg-moss/15 text-ink"
                            : "border-ink/15 bg-white/60 text-ink/70"
                        }`}
                      >
                        Kamp {draft.appliesMatch ? "· til" : "· fra"}
                      </button>
                    </div>
                    {draft.appliesTraining ? (
                      <div className="mt-4">
                        <label className="label" htmlFor={`fine-auto-train-${def.action}`}>
                          Bødeskabelon · træning
                        </label>
                        <select
                          id={`fine-auto-train-${def.action}`}
                          className="input mt-1"
                          value={draft.templateTrainingId}
                          onChange={(event) =>
                            setFineAutomationRules((prev) => {
                              const cur = prev[def.action] ?? emptyFineAutomationRuleDraft();
                              return {
                                ...prev,
                                [def.action]: { ...cur, templateTrainingId: event.target.value }
                              };
                            })
                          }
                        >
                          <option value="">Vælg skabelon</option>
                          {fineAutomationTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.title} · {template.amount} kr
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {draft.appliesMatch ? (
                      <div className="mt-4">
                        <label className="label" htmlFor={`fine-auto-match-${def.action}`}>
                          Bødeskabelon · kamp
                        </label>
                        <select
                          id={`fine-auto-match-${def.action}`}
                          className="input mt-1"
                          value={draft.templateMatchId}
                          onChange={(event) =>
                            setFineAutomationRules((prev) => {
                              const cur = prev[def.action] ?? emptyFineAutomationRuleDraft();
                              return {
                                ...prev,
                                [def.action]: { ...cur, templateMatchId: event.target.value }
                              };
                            })
                          }
                        >
                          <option value="">Vælg skabelon</option>
                          {fineAutomationTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.title} · {template.amount} kr
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <p className="mt-4 text-xs font-semibold text-ink/80">Undtag roller</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {FINE_AUTOMATION_ROLE_KEYS.map((role) => (
                        <label key={`${def.action}-${role}`} className="flex items-center gap-2 text-sm text-ink">
                          <input
                            type="checkbox"
                            checked={draft.excludedRoles.includes(role)}
                            onChange={() => {
                              setFineAutomationRules((prev) => {
                                const current = prev[def.action] ?? emptyFineAutomationRuleDraft();
                                const next = new Set(current.excludedRoles);
                                if (next.has(role)) next.delete(role);
                                else next.add(role);
                                return {
                                  ...prev,
                                  [def.action]: {
                                    ...current,
                                    excludedRoles: Array.from(next)
                                  }
                                };
                              });
                            }}
                          />
                          {roleLabels[role] ?? role}
                        </label>
                      ))}
                    </div>
                  </CollapsibleCard>
                );
              })}
              <LoadingButton
                type="button"
                className="btn-primary w-full sm:w-auto"
                onClick={handleSaveFineAutomation}
                isLoading={fineAutomationSaving}
                idleContent="Gem automatisering"
                loadingContent="Gemmer…"
              />
            </div>
          )}
        </CollapsibleCard>
      ) : null}

      <div className="grid w-full min-w-0 gap-6 lg:grid-cols-2">
        <CollapsibleCard
          title="Hold"
          description="Vælg hvilket hold du arbejder i."
          storageKey={`holdbold:settings:${session.user.id}:hold:${teamId || "none"}`}
        >
          <div className="grid gap-3">
            <select value={teamId} onChange={(event) => handleTeamChange(event.target.value)} className="input">
              <option value="">Vælg hold</option>
              {memberships.map((membership) => (
                <option key={membership.team.id} value={membership.team.id}>
                  {membership.team.name} ({membership.role})
                </option>
              ))}
            </select>
            {isAdmin ? (
              <div className="space-y-2">
                <label className="label">Invitationslink til spillere</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="input flex-1"
                    value={inviteSlug ? `/signup?slug=${inviteSlug}` : ""}
                    readOnly
                    placeholder="Vælg et hold"
                  />
                  <LoadingButton
                    type="button"
                    className="btn-ghost"
                    onClick={handleCopySignupLink}
                    disabled={!inviteSlug}
                    isLoading={copyingInviteLink}
                    idleContent="Kopiér link"
                    loadingContent="Kopierer..."
                  />
                </div>
                <p className="text-xs text-ink/60">
                  Spillere får holdslug udfyldt automatisk og kan ikke ændre den.
                </p>
              </div>
            ) : null}
            {isAdmin ? (
              <div className="space-y-2">
                <label className="label" htmlFor="mobilepay-box">MobilePay box nummer</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="mobilepay-box"
                    className="input flex-1"
                    placeholder="Fx 1234AB"
                    value={mobilePayBox}
                    onChange={(event) => setMobilePayBox(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleSaveMobilePayBox}
                    disabled={savingMobilePayBox || !teamId}
                  >
                    {savingMobilePayBox ? "Gemmer..." : "Gem box"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-6 space-y-3">
            <p className="label">Spillere</p>
            <div className="space-y-2">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-ink/60">Ingen medlemmer fundet.</p>
              ) : (
                teamMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setSelectedMember(member);
                      setMemberRole(member.role);
                    }}
                    className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-left hover:border-ink/30"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-white">
                        {member.user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.user.image} alt={member.user.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="max-w-[140px] truncate text-sm font-semibold text-ink">{member.user.name}</div>
                        <div className="max-w-[140px] block truncate text-xs text-ink/60">{member.user.email ?? "Ingen email"}</div>
                      </div>
                    </div>
                    <span
                      className="block max-w-[40%] shrink-0 truncate rounded-full bg-ink/10 px-3 py-1 text-right text-xs font-semibold text-ink/70 sm:max-w-none"
                      title={
                        member.status === "PENDING"
                          ? "Afventer godkendelse"
                          : roleLabels[member.role] ?? member.role
                      }
                    >
                      {member.status === "PENDING"
                        ? "Afventer godkendelse"
                        : roleLabels[member.role] ?? member.role}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="Tema"
          description="Vælg en farveprofil for dashboardet."
          storageKey={`holdbold:settings:${session.user.id}:tema:${teamId || "none"}`}
        >
          <p className="text-xs text-ink/60">
            {hasUserTheme ? "Du bruger dit personlige tema." : "Du bruger holdets standardtema."}
          </p>
          <div className="mt-4 grid w-full min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleTheme(preset.id)}
                disabled={themeApplyingId !== null}
                className={`w-full min-w-0 rounded-2xl border px-3 py-2.5 text-center text-sm font-semibold ${
                  active === preset.id ? "border-ink bg-white" : "border-ink/10 bg-white/70"
                }`}
              >
                {themeApplyingId === preset.id ? "Gemmer..." : preset.label}
              </button>
            ))}
          </div>
          {hasUserTheme ? (
            <div className="mt-4 w-full">
              <LoadingButton
                type="button"
                className="btn-ghost w-full min-[480px]:w-auto"
                onClick={handleUseTeamTheme}
                isLoading={usingTeamTheme}
                idleContent="Brug holdets standardtema"
                loadingContent="Skifter..."
              />
            </div>
          ) : null}
          {isAdmin ? (
            <div className="mt-3 w-full">
              <button
                type="button"
                className="btn-ghost w-full min-[480px]:w-auto"
                onClick={handleSaveTeamTheme}
                disabled={savingTeamTheme || !teamId}
              >
                {savingTeamTheme ? "Gemmer..." : "Sæt som holdets standardtema"}
              </button>
            </div>
          ) : null}
          {active === "custom" ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: "ink", label: "Tekst" },
                  { key: "clay", label: "Kantfarve" },
                  { key: "moss", label: "Accent" },
                  { key: "ember", label: "Highlight" },
                  { key: "fog", label: "Kortbaggrund" },
                  { key: "button", label: "Knap baggrund" },
                  { key: "buttonText", label: "Knap tekst" },
                  { key: "gradientStart", label: "Baggrund start" },
                  { key: "gradientMid", label: "Baggrund midt" },
                  { key: "gradientEnd", label: "Baggrund slut" }
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex w-full min-w-0 items-center justify-between rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm font-semibold text-ink/80"
                  >
                    <span>{item.label}</span>
                    <input
                      type="color"
                      value={(customTheme as Record<string, string>)[item.key]}
                      onChange={(event) =>
                        setCustomThemeState((prev) => ({ ...prev, [item.key]: event.target.value }))
                      }
                      className="h-8 w-12 cursor-pointer rounded-lg border border-ink/10 bg-white"
                    />
                  </label>
                ))}
              </div>
              <LoadingButton
                type="button"
                className="btn-primary w-full sm:w-auto"
                onClick={handleSaveCustomTheme}
                isLoading={savingCustomTheme}
                idleContent="Gem tilpasset tema"
                loadingContent="Gemmer..."
              />
            </div>
          ) : null}
        </CollapsibleCard>
      </div>

      {isAdmin ? (
        <CollapsibleCard
          title="Integrationer"
          description="Indsæt iCal-link eller upload et Excel-kampprogram."
          storageKey={`holdbold:settings:${session.user.id}:integrationer:${teamId || "none"}`}
        >
          <form className="grid gap-3" onSubmit={handleIcalImport}>
          <div className="space-y-2">
            <label className="label" htmlFor="ical-url">iCal URL</label>
            <input
              id="ical-url"
              className="input"
              value={icalUrl}
              onChange={(event) => setIcalUrl(event.target.value)}
              placeholder="webcal://ical.dbu.dk/Match.ashx?..."
              disabled={!isAdmin || !teamId}
              required
            />
          </div>
          <div className="flex items-end gap-3">
            <button type="submit" className="btn-primary" disabled={!isAdmin || !teamId || icalImporting}>
              {icalImporting ? "Importerer..." : "Importer kampe"}
            </button>
            {!isAdmin ? <span className="text-sm text-ink/60">Kun admin kan importere.</span> : null}
          </div>
        </form>
        <form className="mt-4 grid gap-3" onSubmit={handleXlsxImport}>
          <div className="space-y-2">
            <label className="label" htmlFor="xlsx-file">Excel (.xlsx)</label>
            <input
              id="xlsx-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="input file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.2em] file:text-fog"
              disabled={!isAdmin || !teamId || xlsxImporting}
              onChange={(event) => setXlsxFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="btn-ghost"
              disabled={!isAdmin || !teamId || xlsxImporting || !xlsxFile}
            >
              {xlsxImporting ? "Uploader..." : "Upload kampprogram"}
            </button>
          </div>
        </form>
        <div className="mt-6 space-y-2">
          <p className="label">Importerede feeds</p>
          {icalFeeds.length === 0 ? (
            <p className="text-sm text-ink/60">Ingen iCal feeds endnu.</p>
          ) : (
            icalFeeds.map((feed) => (
              <div key={feed.id} className="rounded-2xl border border-ink/10 bg-white/80 px-4 py-3">
                <div className="text-sm font-semibold text-ink">{feed.name}</div>
                <div className="truncate text-xs text-ink/60">{feed.url}</div>
                <div className="mt-1 text-xs text-ink/50">
                  Sidst importeret:{" "}
                  {feed.lastImportedAt ? new Date(feed.lastImportedAt).toLocaleString("da-DK") : "Aldrig"}
                </div>
              </div>
            ))
          )}
        </div>
        </CollapsibleCard>
      ) : null}

      {selectedMember ? (
        <div className="modal-backdrop" onClick={() => setSelectedMember(null)}>
          <div className="modal-panel max-w-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">{selectedMember.user.name}</h3>
                <p className="mt-2 text-sm text-ink/70">Medlemsoplysninger</p>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedMember(null)} disabled={memberActionSubmitting !== null}>
                Luk
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-ink/70">
              <div>Email: {selectedMember.user.email ?? "—"}</div>
              <div>Rolle: {roleLabels[selectedMember.role] ?? selectedMember.role}</div>
              <div>Status: {statusLabels[selectedMember.status] ?? selectedMember.status}</div>
            </div>
            {isAdmin ? (
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <label className="label">Rolle</label>
                  <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className="input">
                    <option value="ADMIN">Admin</option>
                    <option value="TRAENER">Træner</option>
                    <option value="SPILLER">Spiller</option>
                    <option value="SOME">SoMe</option>
                    <option value="BOEDEKASSEFORMAND">Bødekasseformand</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedMember.status === "PENDING" ? (
                    <LoadingButton
                      className="btn-primary"
                      onClick={handleApproveMember}
                      isLoading={memberActionSubmitting === "approve"}
                      disabled={memberActionSubmitting !== null && memberActionSubmitting !== "approve"}
                      idleContent="Godkend medlem"
                      loadingContent="Godkender..."
                    />
                  ) : (
                    <LoadingButton
                      className="btn-primary"
                      onClick={handleUpdateRole}
                      isLoading={memberActionSubmitting === "updateRole"}
                      disabled={memberActionSubmitting !== null && memberActionSubmitting !== "updateRole"}
                      idleContent="Opdater rolle"
                      loadingContent="Opdaterer..."
                    />
                  )}
                  <button className="btn-ghost" onClick={confirmDeleteMember} disabled={memberActionSubmitting !== null}>
                    Slet bruger
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showDeleteConfirm && selectedMember ? (
        <div className="modal-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-panel max-w-md" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Slet bruger</h3>
                <p className="mt-2 text-sm text-ink/70">
                  Er du sikker på, at du vil slette {selectedMember.user.name ?? "brugeren"}?
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setShowDeleteConfirm(false)} disabled={memberActionSubmitting !== null}>
                Luk
              </button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                className="btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={memberActionSubmitting !== null}
              >
                Fortryd
              </button>
              <LoadingButton
                className="btn-primary"
                onClick={async () => {
                  await handleDeleteMember();
                  setShowDeleteConfirm(false);
                }}
                isLoading={memberActionSubmitting === "delete"}
                disabled={memberActionSubmitting !== null && memberActionSubmitting !== "delete"}
                idleContent="Slet bruger"
                loadingContent="Sletter..."
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
