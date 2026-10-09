"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import Icon from "@/components/ui/Icon";

/**
 * Viser et banner når en lukket sæson er valgt og låser handlingsknapper
 * (.btn-primary og elementer markeret med .season-lock) på kalender/bøder/overblik.
 * Indstillinger er undtaget, så sæsonen kan skiftes tilbage.
 * Serveren afviser alligevel alle ændringer i lukkede sæsoner.
 */
export default function SeasonReadOnlyMain({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { isReadOnlySeason, selectedSeason, activeSeason, selectSeason } = useDashboardTeam();
  const locked = isReadOnlySeason && !pathname.includes("/indstillinger") && !pathname.includes("/profil");

  return (
    <main className="min-w-0 flex-1 space-y-4 sm:space-y-6" data-season-readonly={locked ? "true" : undefined}>
      {isReadOnlySeason && selectedSeason ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[1.375rem] border border-pending/40 bg-pending/12 px-4 py-3 text-sm text-ink"
        >
          <span className="flex items-center gap-2">
            <Icon name="clock" className="h-4 w-4 text-pending" />
            <span>
              Du ser <strong>{selectedSeason.name}</strong> – lukket sæson, kun læsning.
            </span>
          </span>
          {activeSeason ? (
            <button
              type="button"
              className="min-h-9 rounded-xl bg-surface px-3 text-sm font-semibold text-ink shadow-[var(--shadow-sm)] transition active:scale-95"
              onClick={() => selectSeason(activeSeason.id)}
            >
              Tilbage til {activeSeason.name}
            </button>
          ) : null}
        </div>
      ) : null}
      {/* Ny key pr. side giver en blød overgang ved sideskift */}
      <div key={pathname} className="animate-rise space-y-4 sm:space-y-6">
        {children}
      </div>
    </main>
  );
}
