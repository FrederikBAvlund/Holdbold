"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushSettings() {
  const { pushToast } = useToast();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";

  useEffect(() => {
    const canUsePush =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(canUsePush);
    if (!canUsePush) return;

    setPermission(Notification.permission);
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setSubscribed(Boolean(subscription)))
      .catch(() => setSubscribed(false));
  }, []);

  const statusText = useMemo(() => {
    if (!supported) return "Push-notifikationer understøttes ikke på denne enhed/browser.";
    if (!publicKey) return "Push er ikke konfigureret endnu (mangler public key).";
    if (permission === "denied") return "Notifikationer er blokeret i browser/telefon-indstillinger.";
    if (subscribed) return "Push-notifikationer er aktive på denne enhed.";
    return "Aktivér push for at få notifikationer direkte på telefonen.";
  }, [permission, publicKey, subscribed, supported]);

  async function enablePush() {
    if (!supported) return;
    if (!publicKey) {
      pushToast("Push er ikke konfigureret endnu.", "error");
      return;
    }

    setBusy(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        pushToast("Notifikationer blev ikke tilladt.", "error");
        return;
      }

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
        pushToast(data.error ?? "Kunne ikke aktivere push", "error");
        return;
      }

      setSubscribed(true);
      pushToast("Push-notifikationer er aktiveret", "success");
    } catch {
      pushToast("Kunne ikke aktivere push-notifikationer", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!supported) return;
    setBusy(true);
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
      pushToast("Push-notifikationer er slået fra på denne enhed", "success");
    } catch {
      pushToast("Kunne ikke slå push fra", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-soft">
      <h3 className="text-lg font-semibold text-ink">Push-notifikationer</h3>
      <p className="mt-2 text-sm text-ink/70">{statusText}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!subscribed ? (
          <button type="button" className="btn-primary" onClick={enablePush} disabled={busy || !supported}>
            {busy ? "Aktiverer..." : "Aktivér push"}
          </button>
        ) : (
          <button type="button" className="btn-ghost" onClick={disablePush} disabled={busy}>
            {busy ? "Gemmer..." : "Slå push fra"}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-ink/60">
        På iPhone virker push kun når Holdbold er installeret på hjemmeskærmen.
      </p>
    </div>
  );
}

