type FineAutomationRule = {
  action: string;
  appliesTraining: boolean;
  appliesMatch: boolean;
  templateTrainingId?: string | null;
  templateMatchId?: string | null;
  excludedRoles?: string[];
};

type FineAutomationTemplate = {
  id: string;
  title: string;
  amount: number;
  category: string;
};

export type FineAutomationPayload = {
  error?: string;
  rules?: FineAutomationRule[];
  templates?: FineAutomationTemplate[];
};

type FineAutomationFetchResult = { ok: boolean; data: FineAutomationPayload };

const FINE_AUTOMATION_CLIENT_CACHE_MS = 30000;

const cache = new Map<string, { result: FineAutomationFetchResult; fetchedAt: number }>();
const inFlight = new Map<string, Promise<FineAutomationFetchResult>>();

export async function fetchFineAutomationCached(teamId: string): Promise<FineAutomationFetchResult> {
  const now = Date.now();
  const cached = cache.get(teamId);
  if (cached && now - cached.fetchedAt < FINE_AUTOMATION_CLIENT_CACHE_MS) {
    return cached.result;
  }

  const existing = inFlight.get(teamId);
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch(`/api/team/${teamId}/fine-automation`, { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as FineAutomationPayload;
    const result: FineAutomationFetchResult = { ok: response.ok, data };
    if (response.ok) {
      cache.set(teamId, { result, fetchedAt: Date.now() });
    }
    return result;
  })().finally(() => {
    inFlight.delete(teamId);
  });

  inFlight.set(teamId, request);
  return request;
}

export function primeFineAutomationCache(teamId: string, data: FineAutomationPayload) {
  cache.set(teamId, { result: { ok: true, data }, fetchedAt: Date.now() });
}

export function clearFineAutomationClientCache(teamId?: string) {
  if (teamId) {
    cache.delete(teamId);
    inFlight.delete(teamId);
    return;
  }

  cache.clear();
  inFlight.clear();
}
