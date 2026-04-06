const SUPABASE_BUCKET = process.env.SUPABASE_PROFILE_BUCKET ?? "profile-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

function extractObjectPath(imageValue: string): string | null {
  if (imageValue.startsWith("supabase:")) {
    const path = imageValue.slice("supabase:".length);
    return path || null;
  }

  if (imageValue.startsWith("profiles/")) {
    return imageValue;
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
      return null;
    }

    const data = (await signResponse.json()) as { signedURL?: string; signedUrl?: string };
    const signedPath = data.signedURL ?? data.signedUrl;
    if (!signedPath) return null;
    if (signedPath.startsWith("http://") || signedPath.startsWith("https://")) return signedPath;
    return `${supabaseUrl}${signedPath.startsWith("/") ? "" : "/"}${signedPath}`;
  } catch {
    return null;
  }
}
