import { afterEach, describe, expect, it, vi } from "vitest";
import { localProfileImagePath, profileImageExtension } from "./localProfileImages";

afterEach(() => vi.unstubAllEnvs());

describe("local profile image storage", () => {
  it("rejects missing or relative storage directories", () => {
    vi.stubEnv("LOCAL_PROFILE_UPLOAD_DIR", "");
    expect(localProfileImagePath("avatar.jpg")).toBeNull();
    vi.stubEnv("LOCAL_PROFILE_UPLOAD_DIR", "uploads");
    expect(localProfileImagePath("avatar.jpg")).toBeNull();
  });
  it("keeps filenames inside the storage directory", () => {
    vi.stubEnv("LOCAL_PROFILE_UPLOAD_DIR", "/data/profile-images");
    expect(localProfileImagePath("user-123.jpg")).toBe("/data/profile-images/user-123.jpg");
    for (const filename of ["../secret.jpg", "/secret.jpg", "x/secret.jpg", "avatar.svg", "a.jpg.exe"]) {
      expect(localProfileImagePath(filename)).toBeNull();
    }
  });
  it("does not accept executable or SVG upload formats", () => {
    expect(profileImageExtension("image/jpeg")).toBe(".jpg");
    expect(profileImageExtension("image/svg+xml")).toBeNull();
    expect(profileImageExtension("text/html")).toBeNull();
  });
});
