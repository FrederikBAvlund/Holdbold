import DashboardNav from "@/components/DashboardNav";
import PendingAccessGuard from "@/components/PendingAccessGuard";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen pb-nav-pad pt-[max(0.375rem,env(safe-area-inset-top,0px))] lg:pb-10 lg:pt-4">
      <PendingAccessGuard />
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-3 sm:px-5 lg:flex-row lg:gap-7 lg:px-6">
        <DashboardNav
          serverUserName={session.user?.name ?? null}
          serverUserEmail={session.user?.email ?? null}
        />
        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
