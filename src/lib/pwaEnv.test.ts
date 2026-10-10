import { describe, expect, it } from "vitest";
import { classifyDevice, decideGuide, type DeviceEnv } from "./pwaEnv";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1";
const IPHONE_MESSENGER =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0]";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

describe("classifyDevice", () => {
  it("genkender iPhone Safari", () => {
    expect(classifyDevice({ userAgent: IPHONE_SAFARI })).toMatchObject({ isIos: true, isIosSafari: true });
  });
  it("genkender Chrome på iPhone som ikke-Safari", () => {
    expect(classifyDevice({ userAgent: IPHONE_CHROME })).toMatchObject({ isIos: true, isIosSafari: false });
  });
  it("genkender Messenger som in-app-browser", () => {
    expect(classifyDevice({ userAgent: IPHONE_MESSENGER })).toMatchObject({
      isIos: true,
      isInAppBrowser: true,
      isIosSafari: false
    });
  });
  it("genkender iPadOS, der udgiver sig for at være Mac", () => {
    expect(classifyDevice({ userAgent: DESKTOP, platform: "MacIntel", maxTouchPoints: 5 }).isIos).toBe(true);
    expect(classifyDevice({ userAgent: DESKTOP, platform: "MacIntel", maxTouchPoints: 0 }).isIos).toBe(false);
  });
  it("genkender Android", () => {
    expect(classifyDevice({ userAgent: ANDROID })).toMatchObject({ isAndroid: true, isIos: false });
  });
});

describe("decideGuide", () => {
  const ios: DeviceEnv = classifyDevice({ userAgent: IPHONE_SAFARI });
  const android: DeviceEnv = classifyDevice({ userAgent: ANDROID });
  const base = { isStandalone: false, pushSupported: true, pushSubscribed: false, pushBlocked: false };

  it("iPhone i browser → installér-guide", () => {
    expect(decideGuide({ ...base, env: ios, pushSupported: false })).toBe("install");
  });
  it("iPhone som app uden push → push-guide", () => {
    expect(decideGuide({ ...base, env: ios, isStandalone: true })).toBe("push");
  });
  it("iPhone som app med push → ingen guide", () => {
    expect(decideGuide({ ...base, env: ios, isStandalone: true, pushSubscribed: true })).toBeNull();
  });
  it("blokeret push → ingen guide", () => {
    expect(decideGuide({ ...base, env: ios, isStandalone: true, pushBlocked: true })).toBeNull();
  });
  it("Android uden push → push-guide", () => {
    expect(decideGuide({ ...base, env: android })).toBe("push");
  });
  it("ikke understøttet push uden for iOS → ingen guide", () => {
    expect(decideGuide({ ...base, env: android, pushSupported: false })).toBeNull();
  });
});
