"use client";

import { useCallback, useEffect, useState } from "react";
import type { FineCollection, FineItem, FineTemplate, PendingPayment } from "../boderTypes";

export type Debtor = { userId: string; name: string; total: number };

export type FineData = {
  templates: FineTemplate[];
  myFines: FineItem[];
  debtors: Debtor[];
  recent: FineItem[];
  mySubmitted: FineItem[];
  proposed: FineItem[];
  pendingPayments: PendingPayment[];
  collections: FineCollection[];
  mobilePayBox: string;
};

const EMPTY: FineData = {
  templates: [],
  myFines: [],
  debtors: [],
  recent: [],
  mySubmitted: [],
  proposed: [],
  pendingPayments: [],
  collections: [],
  mobilePayBox: ""
};

async function getJson<T>(url: string, pick: (data: Record<string, unknown>) => T, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return fallback;
    return pick(await response.json());
  } catch {
    return fallback;
  }
}

/** Henter alt til Bøder-siden; én URL-opbygning bruges både ved første load og ved refresh. */
export function useFineData(params: {
  teamId: string;
  userId: string;
  seasonQuery: string;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const { teamId, userId, seasonQuery, canManage, isAdmin } = params;
  const [data, setData] = useState<FineData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!teamId || !userId) return;
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const base = `/api/fines?teamId=${teamId}${seasonQuery}`;
    const fines = (url: string) => getJson(url, (d) => (d.fines ?? []) as FineItem[], [] as FineItem[]);
    const [templates, myFines, debtors, recent, mySubmitted, proposed, pendingPayments, collections, mobilePayBox] =
      await Promise.all([
        getJson(`/api/fine-templates?teamId=${teamId}`, (d) => (d.templates ?? []) as FineTemplate[], []),
        fines(`${base}&userId=${userId}`),
        getJson(`/api/fines/debtors?teamId=${teamId}${seasonQuery}`, (d) => (d.debtors ?? []) as Debtor[], []),
        fines(`${base}&since=${encodeURIComponent(since)}`),
        fines(`${base}&createdById=${userId}`),
        canManage ? fines(`${base}&status=FORESLAET`) : Promise.resolve([] as FineItem[]),
        isAdmin
          ? getJson(`/api/fines/payments/pending?teamId=${teamId}`, (d) => (d.payments ?? []) as PendingPayment[], [])
          : Promise.resolve([] as PendingPayment[]),
        canManage
          ? getJson(`/api/fines/collections?teamId=${teamId}`, (d) => (d.collections ?? []) as FineCollection[], [])
          : Promise.resolve([] as FineCollection[]),
        getJson(
          `/api/team/${teamId}`,
          (d) => ((d.team as { mobilePayBox?: string | null } | undefined)?.mobilePayBox ?? "") as string,
          ""
        )
      ]);
    setData({ templates, myFines, debtors, recent, mySubmitted, proposed, pendingPayments, collections, mobilePayBox });
    setLoading(false);
  }, [teamId, userId, seasonQuery, canManage, isAdmin]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  return { ...data, loading, refresh, setData };
}

export async function fetchMemberFines(teamId: string, seasonQuery: string, memberUserId: string) {
  return getJson(
    `/api/fines?teamId=${teamId}${seasonQuery}&userId=${memberUserId}`,
    (d) => (d.fines ?? []) as FineItem[],
    [] as FineItem[]
  );
}
