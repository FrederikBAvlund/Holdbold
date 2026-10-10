import DashboardNav from "@/components/DashboardNav";
import GuideSpotlight from "@/components/guide/GuideSpotlight";
import DashboardTeamProvider, {
  type DashboardMembership
} from "@/components/DashboardTeamProvider";
import SeasonReadOnlyMain from "@/components/SeasonReadOnlyMain";
import PendingAccessGuard from "@/components/PendingAccessGuard";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const allMemberships = (await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { team: true },
    orderBy: { createdAt: "asc" }
  })) as DashboardMembership[];
  const initialMemberships = allMemberships.filter((membership) => membership.status === "ACTIVE");
  const initialPendingMemberships = allMemberships.filter((membership) => membership.status === "PENDING");

  return (
    <div className="min-h-screen pb-nav-pad lg:pb-10 lg:pt-4">
      <DashboardTeamProvider
        initialMemberships={initialMemberships}
        initialPendingMemberships={initialPendingMemberships}
      >
        <PendingAccessGuard />
        <GuideSpotlight />
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-3 sm:px-5 lg:flex-row lg:gap-7 lg:px-6">
          <DashboardNav
            serverUserName={session.user?.name ?? null}
            serverUserEmail={session.user?.email ?? null}
          />
          <SeasonReadOnlyMain>{children}</SeasonReadOnlyMain>
        </div>
      </DashboardTeamProvider>
    </div>
  );
}
