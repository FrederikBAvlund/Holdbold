"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import { SetupGuideBanner } from "@/components/SetupGuide";
import { useToast } from "@/components/ToastProvider";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Card } from "@/components/ui/primitives";
import { rolesLabel } from "@/lib/roleLabels";
import { nextGuideSteps, type GuidePromotion as Promotion } from "@/lib/guide/state";
import GuideChecklist from "@/components/guide/GuideChecklist";
import GuidePromotion from "@/components/guide/GuidePromotion";
import GuideWelcome from "@/components/guide/GuideWelcome";
import { startSpotlight, useGuide } from "@/components/guide/guideClient";

const LATER_KEY = "holdbold-guide-later:";

function readLater(teamId: string) {
  try {
    return window.sessionStorage.getItem(LATER_KEY + teamId) === "1";
  } catch {
    return false;
  }
}

function writeLater(teamId: string) {
  try {
    window.sessionStorage.setItem(LATER_KEY + teamId, "1");
  } catch {
    // Privat browsing – så kommer velkomsten bare igen næste gang
  }
}

/** "Nyt"-kortet til medlemmer, der var med, før guiden fandtes */
function AnnounceCard({
  roles,
  todo,
  onStart,
  onDismiss
}: {
  roles: string[];
  todo: number;
  onStart: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card role="status" className="flex items-start gap-3 border-primary/25 bg-primary/10">
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-moss">
        <Icon name="flag" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-bold uppercase leading-tight">Nyt: Kom godt i gang</p>
        <p className="mt-1 text-sm text-ink/70">
          Se hvad du kan som {rolesLabel(roles)} – {todo === 1 ? "1 ting" : `${todo} ting`}, du ikke har prøvet endnu.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={onStart}>
            Se guiden
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Nej tak
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Guiden på forsiden: velkomst for nye, "Nyt"-kort for eksisterende medlemmer, ellers "Kom i gang"-tjeklisten.
 * Har brugeren fået en ny rolle, vises først det nye – også selvom guiden er skjult.
 */
export default function GuideHome() {
  const router = useRouter();
  const { teamId, memberships } = useDashboardTeam();
  const { state, act } = useGuide(teamId);
  const { pushToast } = useToast();
  const [laterIntro, setLaterIntro] = useState(false);
  const [justStarted, setJustStarted] = useState(false);

  useEffect(() => {
    setLaterIntro(teamId ? readLater(teamId) : false);
    setJustStarted(false);
  }, [teamId]);

  // Indtil guiden er hentet, vises push-banneret som før, så der ikke hopper noget ind og ud
  if (!state) return <SetupGuideBanner />;

  const teamName = memberships.find((membership) => membership.team?.id === teamId)?.team?.name ?? "";

  async function start() {
    setJustStarted(true);
    if (!(await act("start"))) pushToast("Kunne ikke starte guiden", "error");
  }

  async function dismiss() {
    if (await act("dismiss")) pushToast("Guiden er skjult. Du finder den altid under Profil.", "info");
    else pushToast("Kunne ikke skjule guiden", "error");
  }

  /** Fra "Du er blevet …": start guiden og gå direkte til det første nye trin */
  async function showNew(promotion: Promotion) {
    const steps = state?.steps.filter((step) => promotion.stepIds.includes(step.id)) ?? [];
    const first = nextGuideSteps(steps, 1)[0];
    if (!(await act("start"))) {
      pushToast("Kunne ikke starte guiden", "error");
      return;
    }
    if (!first) return;
    if (first.anchor) startSpotlight(first.id);
    router.push(first.href);
  }

  async function laterPromotion() {
    if (!(await act("acknowledge-role"))) pushToast("Noget gik galt – prøv igen", "error");
  }

  // Velkomsten viser allerede alt, så forfremmelsen gælder kun for dem, der har været igennem den
  const promotion = state.mode !== "intro" ? state.promotion : null;

  return (
    <>
      {promotion ? (
        <GuidePromotion
          promotion={promotion}
          teamName={teamName}
          onShow={() => void showNew(promotion)}
          onLater={() => void laterPromotion()}
        />
      ) : null}

      {state.mode === "intro" ? (
        laterIntro ? null : (
          <GuideWelcome
            state={state}
            teamName={teamName}
            onStart={() => void start()}
            onSkip={() => void dismiss()}
            onLater={() => {
              writeLater(teamId);
              setLaterIntro(true);
            }}
          />
        )
      ) : state.mode === "checklist" ? (
        <GuideChecklist state={state} act={act} highlight={justStarted} onDismiss={() => void dismiss()} />
      ) : (
        <>
          {state.mode === "announce" && state.summary.todo > 0 ? (
            <AnnounceCard
              roles={state.roles}
              todo={state.summary.todo}
              onStart={() => void start()}
              onDismiss={() => void dismiss()}
            />
          ) : null}
          <SetupGuideBanner />
        </>
      )}
    </>
  );
}
