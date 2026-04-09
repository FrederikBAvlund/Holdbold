export type MePayload = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    themePreset?: string | null;
    themeConfig?: Record<string, string> | null;
  } | null;
  memberships?: Array<{ team?: { id?: string; name?: string; slug?: string } }>;
};

type MeFetchResult = { ok: boolean; data: MePayload };

let meCache: { result: MeFetchResult; fetchedAt: number } | null = null;
let meInFlight: Promise<MeFetchResult> | null = null;

const ME_CLIENT_CACHE_MS = 8000;

export async function fetchMeCached(): Promise<MeFetchResult> {
  const now = Date.now();
  if (meCache && now - meCache.fetchedAt < ME_CLIENT_CACHE_MS) {
    return meCache.result;
  }
  if (meInFlight) return meInFlight;

  meInFlight = (async () => {
    const response = await fetch("/api/me", { cache: "no-store" });
    const data = (await response.json()) as MePayload;
    const result: MeFetchResult = { ok: response.ok, data };
    if (response.ok) {
      meCache = { result, fetchedAt: Date.now() };
    }
    return result;
  })().finally(() => {
    meInFlight = null;
  });

  return meInFlight;
}

export function clearMeClientCache() {
  meCache = null;
}
