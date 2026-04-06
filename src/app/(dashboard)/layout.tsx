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
    <div className="min-h-screen pb-24 pt-2 lg:pb-10 lg:pt-4">
      <PendingAccessGuard />
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-3 sm:px-5 lg:flex-row lg:gap-7 lg:px-6">
        <DashboardNav />
        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
