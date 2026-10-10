import path from "node:path";

export const LOCAL_PROFILE_IMAGE_PREFIX = "/api/profile-images/";

export function localProfileImagePath(filename: string): string | null {
  const directory = process.env.LOCAL_PROFILE_UPLOAD_DIR;
  if (!directory || !path.isAbsolute(directory)) return null;
  if (!/^[a-zA-Z0-9_-]+\.(png|jpg|webp|gif|avif)$/.test(filename)) return null;
  return path.join(directory, filename);
}

export function profileImageExtension(mime: string): string | null {
  return ({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
    "image/gif": ".gif", "image/avif": ".avif" } as Record<string, string>)[mime] ?? null;
}
