"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import Switch from "@/components/ui/Switch";
import Icon from "@/components/ui/Icon";

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

/** Række med kontakt til push-notifikationer på denne enhed. */
export default function PushSettings() {
  const { pushToast } = useToast();
  const [supported, setSupported] = useState(true);
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

  const blocked = permission === "denied";
  const unavailable = !supported || !publicKey;

  let description = "Få besked på telefonen om nye begivenheder og bøder.";
  if (!supported) description = "Understøttes ikke i denne browser. På iPhone: føj Holdbold til hjemmeskærmen først.";
  else if (!publicKey) description = "Push er ikke sat op endnu.";
  else if (blocked) description = "Blokeret. Slå notifikationer til for Holdbold i telefonens eller browserens indstillinger.";
  else if (subscribed) description = "Slået til på denne enhed.";

  async function enablePush() {
    setBusy(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        pushToast("Notifikationer blev ikke tilladt", "error");
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
      pushToast("Push er slået til", "success");
    } catch {
      pushToast("Kunne ikke aktivere push", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
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
      pushToast("Push er slået fra på denne enhed", "success");
    } catch {
      pushToast("Kunne ikke slå push fra", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[3.75rem] items-center gap-3 px-4 py-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-moss">
        <Icon name="bell" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">Push-notifikationer</span>
        <span className="block text-sm text-ink/55">{description}</span>
      </span>
      <Switch
        label="Push-notifikationer"
        checked={subscribed}
        busy={busy}
        disabled={unavailable || (blocked && !subscribed)}
        onChange={(next) => (next ? enablePush() : disablePush())}
      />
    </div>
  );
}
