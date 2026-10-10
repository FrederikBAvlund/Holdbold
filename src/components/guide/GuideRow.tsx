"use client";

import { useState } from "react";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import { useToast } from "@/components/ToastProvider";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { ListRow } from "@/components/ui/primitives";
import { roleLabel } from "@/lib/roleLabels";
import GuideStepList from "@/components/guide/GuideStepList";
import { ProgressRing } from "@/components/guide/GuideChecklist";
import { useGuide } from "@/components/guide/guideClient";

/** Fast række i Profil: hele guiden for din rolle, også efter den er skjult eller sprunget over. */
export default function GuideRow() {
  const { teamId } = useDashboardTeam();
  const { state, act } = useGuide(teamId);
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!state) return null;

  const showsOnHome = state.mode === "checklist";

  async function restart() {
    setBusy(true);
    const ok = await act("restart");
    setBusy(false);
    pushToast(ok ? "Guiden er tilbage på forsiden" : "Kunne ikke starte guiden", ok ? "success" : "error");
  }

  return (
    <>
      <ListRow
        onClick={() => setOpen(true)}
        chevron
        leading={
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
            <Icon name="flag" />
          </span>
        }
        title="Kom godt i gang"
        subtitle={`Guide til dig som ${roleLabel(state.role)} · ${state.summary.done} af ${state.summary.total} klaret`}
      />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Kom godt i gang"
        description={`Det hele, du kan som ${roleLabel(state.role)}.`}
      >
        <div className="-mx-4 sm:-mx-5">
          <div className="flex items-center gap-3 px-4 pb-4 sm:px-5">
            <ProgressRing done={state.summary.done} total={state.summary.total} />
            <p className="text-sm text-ink/60">
              {state.summary.todo === 0
                ? "Du har været det hele igennem."
                : `${state.summary.todo} ting tilbage${state.summary.skipped > 0 ? ` · ${state.summary.skipped} sprunget over` : ""}`}
            </p>
          </div>
          <GuideStepList steps={state.steps} act={act} grouped onNavigate={() => setOpen(false)} />
        </div>
        {showsOnHome && state.summary.skipped === 0 ? null : (
          <Button block className="mt-5" variant="secondary" loading={busy} onClick={() => void restart()}>
            {showsOnHome ? "Vis de oversprungne igen" : "Vis guiden på forsiden"}
          </Button>
        )}
      </Sheet>
    </>
  );
}
