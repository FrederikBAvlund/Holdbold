/** Ren logik til at afgøre hvilken opsætningsguide (hvis nogen) brugeren bør se. */

export type DeviceEnv = {
  isIos: boolean;
  isAndroid: boolean;
  /** Messenger, Facebook, Instagram m.fl. – kan ikke føje til hjemmeskærm. */
  isInAppBrowser: boolean;
  /** Rigtig Safari på iOS (ikke Chrome/Firefox/Edge eller in-app-browser). */
  isIosSafari: boolean;
};

export type GuideKind = "install" | "push";

export function classifyDevice(input: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}): DeviceEnv {
  const ua = input.userAgent ?? "";
  // iPadOS 13+ udgiver sig for at være en Mac, men har touch.
  const iPadOs = input.platform === "MacIntel" && (input.maxTouchPoints ?? 0) > 1;
  const isIos = /iPhone|iPad|iPod/i.test(ua) || iPadOs;
  const isAndroid = /Android/i.test(ua);
  const isInAppBrowser = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|Snapchat|TikTok/i.test(ua);
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua);
  return {
    isIos,
    isAndroid,
    isInAppBrowser,
    isIosSafari: isIos && !isInAppBrowser && !isOtherIosBrowser
  };
}

export function decideGuide(input: {
  env: DeviceEnv;
  isStandalone: boolean;
  pushSupported: boolean;
  pushSubscribed: boolean;
  pushBlocked: boolean;
}): GuideKind | null {
  const { env, isStandalone, pushSupported, pushSubscribed, pushBlocked } = input;
  // På iPhone/iPad kræver push, at appen ligger på hjemmeskærmen.
  if (env.isIos && !isStandalone) return "install";
  if (pushSubscribed || pushBlocked) return null;
  if (pushSupported) return "push";
  return null;
}
