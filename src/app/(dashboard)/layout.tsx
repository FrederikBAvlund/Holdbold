import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Overblik" },
  { href: "/dashboard/kalender", label: "Kalender" },
  { href: "/dashboard/boder", label: "Bøder" },
  { href: "/dashboard/indstillinger", label: "Indstillinger" }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="card hidden w-full lg:block lg:w-64">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-moss">Holdbold</p>
            <h1 className="text-2xl font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Dashboard
            </h1>
            <p className="text-sm text-ink/60">Alt samlet ét sted.</p>
          </div>
          <nav className="mt-6 flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-transparent bg-ink/5 px-4 py-3 text-sm font-semibold text-ink/80 transition hover:border-ink/30 hover:bg-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 space-y-6">{children}</main>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink/10 bg-white/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-around px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink/70">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 hover:bg-ink/5">
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
