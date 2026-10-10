"use client";

import { useEffect, useState } from "react";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import { SetupGuideBanner } from "@/components/SetupGuide";
import { useToast } from "@/components/ToastProvider";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Card } from "@/components/ui/primitives";
import { roleLabel } from "@/lib/roleLabels";
import GuideChecklist from "@/components/guide/GuideChecklist";
import GuideWelcome from "@/components/guide/GuideWelcome";
import { useGuide } from "@/components/guide/guideClient";

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

/** Guiden på forsiden: velkomst for nye, "Nyt"-kort for eksisterende medlemmer, ellers "Kom i gang"-tjeklisten. */
export default function GuideHome() {
  const { teamId, memberships } = useDashboardTeam();
  const { state, act } = useGuide(teamId);
  const { pushToast } = useToast();
  const [later, setLater] = useState(false);
  const [justStarted, setJustStarted] = useState(false);

  useEffect(() => {
    setLater(teamId ? readLater(teamId) : false);
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

  if (state.mode === "intro") {
    return later ? null : (
      <GuideWelcome
        state={state}
        teamName={teamName}
        onStart={() => void start()}
        onSkip={() => void dismiss()}
        onLater={() => {
          writeLater(teamId);
          setLater(true);
        }}
      />
    );
  }

  if (state.mode === "checklist") {
    return <GuideChecklist state={state} act={act} highlight={justStarted} onDismiss={() => void dismiss()} />;
  }

  return (
    <>
      {state.mode === "announce" && state.summary.todo > 0 ? (
        <Card role="status" className="flex items-start gap-3 border-primary/25 bg-primary/10">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-moss">
            <Icon name="flag" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold uppercase leading-tight">Nyt: Kom godt i gang</p>
            <p className="mt-1 text-sm text-ink/70">
              Se hvad du kan som {roleLabel(state.role)} –{" "}
              {state.summary.todo === 1 ? "1 ting" : `${state.summary.todo} ting`}, du ikke har prøvet endnu.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void start()}>
                Se guiden
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void dismiss()}>
                Nej tak
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
      <SetupGuideBanner />
    </>
  );
}
