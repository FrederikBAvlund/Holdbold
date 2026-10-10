"use client";

import { useCallback, useEffect, useState } from "react";
import { classifyDevice, decideGuide, type DeviceEnv, type GuideKind } from "@/lib/pwaEnv";

const NO_DEVICE: DeviceEnv = { isIos: false, isAndroid: false, isInAppBrowser: false, isIosSafari: false };
const DISMISS_KEY = "holdbold-setup-guide-dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export type PushResult = { ok: true } | { ok: false; error: string };

/** Status for appinstallation og push på denne enhed + handlinger til at slå push til/fra. */
export function usePwaStatus() {
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<DeviceEnv>(NO_DEVICE);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";

  useEffect(() => {
    setDevice(
      classifyDevice({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints
      })
    );
    setIsStandalone(
      window.matchMedia?.("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
    setDismissed(readDismissed());

    const canUsePush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushSupported(canUsePush);
    if (!canUsePush) {
      setReady(true);
      return;
    }
    setPermission(Notification.permission);
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setSubscribed(Boolean(subscription)))
      .catch(() => setSubscribed(false))
      .finally(() => setReady(true));
  }, []);

  const enablePush = useCallback(async (): Promise<PushResult> => {
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return { ok: false, error: "Notifikationer blev ikke tilladt" };

      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { ok: false, error: data.error ?? "Kunne ikke aktivere push" };
      }
      setSubscribed(true);
      return { ok: true };
    } catch {
      return { ok: false, error: "Kunne ikke aktivere push" };
    }
  }, [publicKey]);

  const disablePush = useCallback(async (): Promise<PushResult> => {
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      return { ok: true };
    } catch {
      return { ok: false, error: "Kunne ikke slå push fra" };
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* localStorage kan være utilgængelig */
    }
  }, []);

  const pushBlocked = permission === "denied";
  const pushAvailable = pushSupported && Boolean(publicKey);
  // Push-nøglen er ikke sat op lokalt – så giver push-guiden ingen mening, men installér-guiden gør.
  const guide: GuideKind | null = ready
    ? decideGuide({
        env: device,
        isStandalone,
        pushSupported: pushAvailable,
        pushSubscribed: subscribed,
        pushBlocked
      })
    : null;

  return {
    ready,
    device,
    isStandalone,
    pushSupported,
    pushAvailable,
    pushBlocked,
    permission,
    subscribed,
    guide,
    showBanner: guide !== null && !dismissed,
    dismiss,
    enablePush,
    disablePush
  };
}
