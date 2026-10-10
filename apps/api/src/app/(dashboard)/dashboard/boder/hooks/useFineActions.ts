"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type Method = "POST" | "DELETE" | "PATCH";

/** Generisk handling mod bøde-API'et med toast og efterfølgende refresh. */
export function useFineActions(refresh: () => Promise<void>) {
  const { pushToast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = useCallback(
    async (
      key: string,
      url: string,
      options: { method?: Method; body?: unknown; success: string; error: string }
    ) => {
      if (busyKey) return false;
      setBusyKey(key);
      try {
        const response = await fetch(url, {
          method: options.method ?? "POST",
          headers: options.body ? { "Content-Type": "application/json" } : undefined,
          body: options.body ? JSON.stringify(options.body) : undefined
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          pushToast(typeof data.error === "string" ? data.error : options.error, "error");
          return false;
        }
        pushToast(options.success, "success");
        await refresh();
        return true;
      } finally {
        setBusyKey(null);
      }
    },
    [busyKey, pushToast, refresh]
  );

  return { run, busyKey };
}

/** Opretter samme bøde til flere spillere og rapporterer delvis succes ærligt. */
export async function createFinesFor(
  userIds: string[],
  payload: Record<string, unknown>
): Promise<{ ok: number; failed: string[]; firstError?: string }> {
  const results = await Promise.all(
    userIds.map(async (userId) => {
      const response = await fetch("/api/fines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, userId })
      });
      const data = response.ok ? null : await response.json().catch(() => ({}));
      return { userId, ok: response.ok, error: typeof data?.error === "string" ? data.error : undefined };
    })
  );
  return {
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).map((r) => r.userId),
    firstError: results.find((r) => r.error)?.error
  };
}
