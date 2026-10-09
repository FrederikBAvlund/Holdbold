"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";

/**
 * Viser et banner når en lukket sæson er valgt og låser handlingsknapper (.btn-primary)
 * på kalender/bøder/overblik. Indstillinger er undtaget, så sæsonen kan skiftes tilbage.
 * Serveren afviser alligevel alle ændringer i lukkede sæsoner.
 */
export default function SeasonReadOnlyMain({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { isReadOnlySeason, selectedSeason, activeSeason, selectSeason } = useDashboardTeam();
  const locked = isReadOnlySeason && !pathname.includes("/indstillinger");

  return (
    <main className="min-w-0 flex-1 space-y-6" data-season-readonly={locked ? "true" : undefined}>
      {isReadOnlySeason && selectedSeason ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>
            Du ser <strong>{selectedSeason.name}</strong> (lukket sæson) – kun læsning.
          </span>
          {activeSeason ? (
            <button type="button" className="btn-ghost" onClick={() => selectSeason(activeSeason.id)}>
              Tilbage til {activeSeason.name}
            </button>
          ) : null}
        </div>
      ) : null}
      {children}
    </main>
  );
}
