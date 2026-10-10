import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, effectiveThemeId } from "./themePresets";

describe("effectiveThemeId", () => {
  it("prefers the user's own theme", () => {
    expect(effectiveThemeId("forest", "crimson")).toBe("forest");
  });
  it("falls back to the team theme for new users", () => {
    expect(effectiveThemeId(null, "crimson")).toBe("crimson");
  });
  it("falls back to the default when neither is valid", () => {
    expect(effectiveThemeId("sunset", undefined)).toBe(DEFAULT_THEME_ID);
  });
  it("supports custom themes", () => {
    expect(effectiveThemeId(null, "custom")).toBe("custom");
  });
});
