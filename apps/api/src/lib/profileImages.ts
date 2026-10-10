const SUPABASE_BUCKET = process.env.SUPABASE_PROFILE_BUCKET ?? "profile-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

/** In-memory cache to avoid repeated Supabase sign calls per server instance. */
const signedUrlCache = new Map<string, { url: string | null; expiresAt: number }>();
const SIGN_CACHE_MS = 45 * 60 * 1000;

function extractObjectPath(imageValue: string): string | null {
  if (imageValue.startsWith("supabase:")) {
    const path = imageValue.slice("supabase:".length);
    return path || null;
  }

  if (imageValue.startsWith("profiles/")) {
    return imageValue;
  }

  // Backward compatibility: if an old signed/public Supabase URL is stored,
  // extract the storage object path so we can mint a fresh signed URL.
  try {
    const parsed = new URL(imageValue);
    const marker = `/storage/v1/object/sign/${SUPABASE_BUCKET}/`;
    const markerPublic = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
    const rawPath = parsed.pathname.includes(marker)
      ? parsed.pathname.split(marker)[1]
      : parsed.pathname.includes(markerPublic)
        ? parsed.pathname.split(markerPublic)[1]
        : null;
    if (rawPath) {
      return decodeURIComponent(rawPath);
    }
  } catch {
    // ignore parse errors and fall through
  }

  return null;
}

export async function resolveProfileImageUrl(imageValue?: string | null): Promise<string | null> {
  if (!imageValue) return null;

  if (
    imageValue.startsWith("http://") ||
    imageValue.startsWith("https://") ||
    imageValue.startsWith("/uploads/")
  ) {
    return imageValue;
  }

  const objectPath = extractObjectPath(imageValue);
  if (!objectPath) return imageValue;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const cacheKey = `${objectPath}`;
  const now = Date.now();
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  try {
    const signResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${SUPABASE_BUCKET}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS })
      }
    );

    if (!signResponse.ok) {
      signedUrlCache.set(cacheKey, { url: null, expiresAt: now + 60_000 });
      return null;
    }

    const data = (await signResponse.json()) as { signedURL?: string; signedUrl?: string };
    const signedPath = data.signedURL ?? data.signedUrl;
    if (!signedPath) {
      signedUrlCache.set(cacheKey, { url: null, expiresAt: now + 60_000 });
      return null;
    }
    let resolved: string;
    if (signedPath.startsWith("http://") || signedPath.startsWith("https://")) resolved = signedPath;
    else if (signedPath.startsWith("/storage/v1/")) resolved = `${supabaseUrl}${signedPath}`;
    else if (signedPath.startsWith("/object/")) resolved = `${supabaseUrl}/storage/v1${signedPath}`;
    else resolved = `${supabaseUrl}/storage/v1/${signedPath.replace(/^\/+/, "")}`;
    signedUrlCache.set(cacheKey, { url: resolved, expiresAt: now + SIGN_CACHE_MS });
    return resolved;
  } catch {
    return null;
  }
}
