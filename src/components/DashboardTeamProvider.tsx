"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useSession } from "next-auth/react";
import {
  getStoredTeamId,
  setStoredTeamId,
  STORAGE_TEAM_ID,
  TEAM_ID_STORAGE_EVENT
} from "@/components/appState";
import { clearMeClientCache, fetchMeCached, type MePayload } from "@/lib/meClientCache";

export type DashboardMembership = NonNullable<MePayload["memberships"]>[number];

export type DashboardTeamMember = {
  id: string;
  role: string;
  status: string;
  user: {
    id: string;
    name: string | null;
    email?: string | null;
    image?: string | null;
  };
};

type DashboardTeamContextValue = {
  userId: string;
  teamId: string;
  setTeamId: (id: string) => void;
  memberships: DashboardMembership[];
  members: DashboardTeamMember[];
  actingMember: DashboardTeamMember | undefined;
  membersLoading: boolean;
  membershipsLoading: boolean;
  refreshDashboardTeam: () => Promise<void>;
};

const DashboardTeamContext = createContext<DashboardTeamContextValue | null>(null);

const invalidateListeners = new Set<() => void>();

export function invalidateDashboardTeam() {
  invalidateListeners.forEach((fn) => {
    fn();
  });
}

export function useDashboardTeam() {
  const ctx = useContext(DashboardTeamContext);
  if (!ctx) {
    throw new Error("useDashboardTeam must be used within DashboardTeamProvider");
  }
  return ctx;
}

export default function DashboardTeamProvider({
  children,
  initialMemberships
}: {
  children: ReactNode;
  initialMemberships: DashboardMembership[];
}) {
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id ?? "";

  const [teamId, setTeamIdState] = useState("");
  const [memberships, setMemberships] = useState<DashboardMembership[]>(initialMemberships);
  const [members, setMembers] = useState<DashboardTeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [membersReloadNonce, setMembersReloadNonce] = useState(0);

  const setTeamId = useCallback((id: string) => {
    setTeamIdState(id);
    setStoredTeamId(id);
  }, []);

  useEffect(() => {
    setTeamIdState(getStoredTeamId());
  }, []);

  useEffect(() => {
    function onTeamIdEvent(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === "string") setTeamIdState(detail);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_TEAM_ID && event.newValue) setTeamIdState(event.newValue);
    }
    window.addEventListener(TEAM_ID_STORAGE_EVENT, onTeamIdEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TEAM_ID_STORAGE_EVENT, onTeamIdEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!userId) {
      setMemberships([]);
      setMembershipsLoading(false);
      return;
    }
    let cancelled = false;
    setMembershipsLoading(true);
    (async () => {
      const { ok, data } = await fetchMeCached();
      if (cancelled) return;
      if (ok) setMemberships(data.memberships ?? []);
      setMembershipsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, sessionStatus]);

  useEffect(() => {
    if (!memberships.length) return;
    const firstTeam = memberships[0]?.team?.id;
    if (!firstTeam) return;

    const stored = getStoredTeamId();
    const effective = teamId || stored;
    const isValid = memberships.some((m) => m.team?.id === effective);

    if (!effective || !isValid) {
      setTeamId(firstTeam);
      return;
    }

    if (teamId !== effective) {
      setTeamIdState(effective);
    }
  }, [memberships, teamId, setTeamId]);

  useEffect(() => {
    if (!teamId || !userId) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    (async () => {
      try {
        const response = await fetch(`/api/team-members?teamId=${teamId}`, { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        setMembers((data.members ?? []) as DashboardTeamMember[]);
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, userId, membersReloadNonce]);

  const refreshDashboardTeam = useCallback(async () => {
    clearMeClientCache();
    const { ok, data } = await fetchMeCached();
    if (ok) setMemberships(data.memberships ?? []);
    setMembersReloadNonce((n) => n + 1);
  }, []);

  const runInvalidate = useCallback(() => {
    void refreshDashboardTeam();
  }, [refreshDashboardTeam]);

  useEffect(() => {
    invalidateListeners.add(runInvalidate);
    return () => {
      invalidateListeners.delete(runInvalidate);
    };
  }, [runInvalidate]);

  const actingMember = useMemo(
    () => members.find((m) => m.user.id === userId),
    [members, userId]
  );

  const value = useMemo(
    () => ({
      userId,
      teamId,
      setTeamId,
      memberships,
      members,
      actingMember,
      membersLoading,
      membershipsLoading,
      refreshDashboardTeam
    }),
    [
      userId,
      teamId,
      setTeamId,
      memberships,
      members,
      actingMember,
      membersLoading,
      membershipsLoading,
      refreshDashboardTeam
    ]
  );

  return <DashboardTeamContext.Provider value={value}>{children}</DashboardTeamContext.Provider>;
}
