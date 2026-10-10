"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useToast } from "@/components/ToastProvider";
import {
  AddToHomeIllustration,
  OpenAsWebAppIllustration,
  SafariMoreIllustration,
  SafariShareIllustration
} from "@/components/SetupGuideIllustrations";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { Card, ListRow } from "@/components/ui/primitives";
import type { GuideKind } from "@/lib/pwaEnv";
import { usePwaStatus } from "@/lib/usePwaStatus";

type Step = { title: string; text: ReactNode; visual?: ReactNode };

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-6">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-on-primary">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-semibold text-ink">{step.title}</p>
            <p className="text-sm text-ink/65">{step.text}</p>
            {step.visual ? <div className="pt-1">{step.visual}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Screenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={780}
      height={550}
      sizes="(max-width: 640px) 80vw, 320px"
      className="mx-auto h-auto w-full max-w-[18rem] rounded-2xl border border-line shadow-[var(--shadow-sm)]"
    />
  );
}

function installSteps(inAppBrowser: boolean): Step[] {
  return [
    {
      title: "Åbn Holdbold i Safari",
      text: inAppBrowser
        ? "Du kigger lige nu på siden inde i en anden app (fx Messenger). Åbn Safari og skriv holdbold.dk/login – det kan ikke lade sig gøre herfra."
        : "Gå til holdbold.dk/login i Safari og log ind. Det virker ikke i Chrome eller inde i Messenger."
    },
    {
      title: "Tryk på ‘…’ nederst til højre",
      text: "Det er i Safari – ikke i et link, du har åbnet i Messenger.",
      visual: <SafariMoreIllustration />
    },
    { title: "Tryk ‘Del’", text: "Vælg ‘Del’ i menuen.", visual: <SafariShareIllustration /> },
    {
      title: "Tryk ‘Føj til hjemmeskærm’",
      text: "Scroll ned til bunden af listen, og tryk på ‘Føj til hjemmeskærm’.",
      visual: <AddToHomeIllustration />
    },
    {
      title: "Sørg for ‘Åbn som webapp’",
      text: "Kontakten skal være slået til. Tryk så ‘Tilføj’.",
      visual: <OpenAsWebAppIllustration />
    },
    {
      title: "Åbn appen fra hjemmeskærmen",
      text: "Find Holdbold-ikonet på hjemmeskærmen, åbn den, og log ind. Kom så tilbage til denne guide for at slå push til."
    }
  ];
}

function PushSteps({ onDone }: { onDone: () => void }) {
  const { pushToast } = useToast();
  const { pushAvailable, pushBlocked, subscribed, enablePush } = usePwaStatus();
  const [busy, setBusy] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  async function turnOn() {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    if (!result.ok) {
      pushToast(result.error, "error");
      return;
    }
    setJustEnabled(true);
    pushToast("Push er slået til", "success");
  }

  const on = subscribed || justEnabled;

  return (
    <div className="space-y-5">
      <StepList
        steps={[
          {
            title: "Gå til Indstillinger",
            text: "Tryk på dit profilbillede øverst til højre, og scroll ned til ‘Push-notifikationer’.",
            visual: <Screenshot src="/guide/push-settings.webp" alt="Profilsiden med kontakten Push-notifikationer" />
          },
          {
            title: "Slå push til",
            text: "Tryk på kontakten, og vælg ‘Tillad’, når telefonen spørger. Du kan også gøre det herfra:"
          }
        ]}
      />
      {on ? (
        <Card className="flex items-center gap-3 border-in/30 bg-in/10 text-sm font-semibold">
          <Icon name="bell" /> Push er slået til på denne enhed.
        </Card>
      ) : pushBlocked ? (
        <p className="text-sm text-danger">
          Notifikationer er blokeret. Slå dem til for Holdbold i telefonens indstillinger under Notifikationer.
        </p>
      ) : (
        <Button block size="lg" loading={busy} disabled={!pushAvailable} onClick={() => void turnOn()}>
          Slå push til
        </Button>
      )}
      {on ? (
        <Button block variant="secondary" onClick={onDone}>
          Færdig
        </Button>
      ) : null}
    </div>
  );
}

/** Guiden selv. `kind` vælger spor; uden `kind` vælges det automatisk ud fra enheden. */
export function SetupGuideSheet({ open, onClose, kind }: { open: boolean; onClose: () => void; kind?: GuideKind | null }) {
  const { device, isStandalone, guide } = usePwaStatus();
  const active: GuideKind = kind ?? guide ?? (device.isIos && !isStandalone ? "install" : "push");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={active === "install" ? "Føj Holdbold til hjemmeskærmen" : "Slå push-notifikationer til"}
      description={
        active === "install"
          ? "På iPhone skal Holdbold ligge på hjemmeskærmen, før du kan få push. Det tager et minut."
          : "Få besked på telefonen om nye begivenheder og bøder."
      }
    >
      {active === "install" ? <StepList steps={installSteps(device.isInAppBrowser)} /> : <PushSteps onDone={onClose} />}
      {active === "install" && !device.isIos ? (
        <p className="mt-5 rounded-xl bg-ink/[0.05] p-3 text-sm text-ink/65">
          Guiden gælder iPhone. På Android åbner du browserens menu og vælger ‘Installér app’ eller ‘Føj til
          startskærm’.
        </p>
      ) : null}
    </Sheet>
  );
}

/** Kort, der foreslår opsætning, når appen ikke er installeret, eller push ikke er slået til. Kan skjules. */
export function SetupGuideBanner() {
  const { showBanner, guide, dismiss } = usePwaStatus();
  const [open, setOpen] = useState(false);

  if (!showBanner || !guide) return null;

  return (
    <>
      <Card role="status" className="flex items-start gap-3 border-primary/25 bg-primary/10">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-moss">
          <Icon name="bell" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold uppercase leading-tight">
            {guide === "install" ? "Få Holdbold som app" : "Slå push til"}
          </p>
          <p className="mt-1 text-sm text-ink/70">
            {guide === "install"
              ? "Føj Holdbold til hjemmeskærmen, så du kan få besked om begivenheder og bøder."
              : "Få besked på telefonen om nye begivenheder og bøder."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              Se guide
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Skjul
            </Button>
          </div>
        </div>
      </Card>
      <SetupGuideSheet open={open} onClose={() => setOpen(false)} kind={guide} />
    </>
  );
}

/** Fast række (fx i Profil), så guiden kan åbnes igen efter den er skjult. */
export function SetupGuideRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListRow
        onClick={() => setOpen(true)}
        chevron
        leading={
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
            <Icon name="share" />
          </span>
        }
        title="Opsætningsguide"
        subtitle="Føj til hjemmeskærm og slå push til"
      />
      <SetupGuideSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
