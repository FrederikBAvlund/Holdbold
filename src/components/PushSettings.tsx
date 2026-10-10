"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import Switch from "@/components/ui/Switch";
import Icon from "@/components/ui/Icon";
import { usePwaStatus } from "@/lib/usePwaStatus";

/** Række med kontakt til push-notifikationer på denne enhed. */
export default function PushSettings() {
  const { pushToast } = useToast();
  const { ready, pushSupported, permission, subscribed, enablePush, disablePush } = usePwaStatus();
  // Undgå at vise "understøttes ikke" mens enheden endnu tjekkes.
  const supported = !ready || pushSupported;
  const [busy, setBusy] = useState(false);

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";
  const blocked = permission === "denied";
  const unavailable = !supported || !publicKey;

  let description = "Få besked på telefonen om nye begivenheder og bøder.";
  if (!supported) description = "Understøttes ikke i denne browser. På iPhone: føj Holdbold til hjemmeskærmen først.";
  else if (!publicKey) description = "Push er ikke sat op endnu.";
  else if (blocked) description = "Blokeret. Slå notifikationer til for Holdbold i telefonens eller browserens indstillinger.";
  else if (subscribed) description = "Slået til på denne enhed.";

  async function toggle(next: boolean) {
    setBusy(true);
    const result = await (next ? enablePush() : disablePush());
    setBusy(false);
    if (!result.ok) pushToast(result.error, "error");
    else pushToast(next ? "Push er slået til" : "Push er slået fra på denne enhed", "success");
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
        onChange={(next) => void toggle(next)}
      />
    </div>
  );
}
