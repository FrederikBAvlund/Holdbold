"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";

export default function PendingAccessGuard() {
  const { data: session } = useSession();
  const { teamPending } = useDashboardTeam();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const hasActiveMembership = session?.user?.hasActiveMembership === true;
    const hasPendingMembership = session?.user?.hasPendingMembership === true;
    const isSettingsPath =
      pathname === "/dashboard/profil" ||
      pathname.startsWith("/dashboard/profil/") ||
      pathname === "/dashboard/indstillinger" ||
      pathname.startsWith("/dashboard/indstillinger/");

    if (((!hasActiveMembership && hasPendingMembership) || teamPending) && !isSettingsPath) {
      router.replace("/dashboard/profil?notice=pending_approval");
    }
  }, [pathname, router, teamPending, session?.user?.hasActiveMembership, session?.user?.hasPendingMembership]);

  return null;
}

