"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function PendingAccessGuard() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const hasActiveMembership = session?.user?.hasActiveMembership === true;
    const hasPendingMembership = session?.user?.hasPendingMembership === true;
    const isSettingsPath =
      pathname === "/dashboard/indstillinger" || pathname.startsWith("/dashboard/indstillinger/");

    if (!hasActiveMembership && hasPendingMembership && !isSettingsPath) {
      router.replace("/dashboard/indstillinger?notice=pending_approval");
    }
  }, [pathname, router, session?.user?.hasActiveMembership, session?.user?.hasPendingMembership]);

  return null;
}

