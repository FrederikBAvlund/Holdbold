"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Overblik", icon: "home" },
  { href: "/dashboard/kalender", label: "Kalender", icon: "calendar" },
  { href: "/dashboard/boder", label: "Bøder", icon: "receipt" },
  { href: "/dashboard/notifikationer", label: "Notifikationer", icon: "bell" },
  { href: "/dashboard/indstillinger", label: "Indstillinger", icon: "settings" }
];

const icons = {
  home: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M6 17h12l-1.5-2V11a4.5 4.5 0 1 0-9 0v4L6 17Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19 12a7 7 0 0 0-.1-1l2.1-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-1.7-1L12.7 2h-4l-.8 2.9c-.6.3-1.2.6-1.7 1l-2.5-1-2 3.5L3.8 11a7 7 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.8 2.9h4l.8-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5-2.1-1.6c.1-.3.1-.7.1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
};

export default function DashboardNav() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    async function loadCount() {
      if (!session?.user?.id) return;
      const response = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setUnreadCount(data.count ?? 0);
    }

    loadCount();
    timer = setInterval(loadCount, 30000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    function onUnreadUpdate(event: Event) {
      const custom = event as CustomEvent<number>;
      setUnreadCount(custom.detail ?? 0);
    }

    window.addEventListener("notifications:unread", onUnreadUpdate);
    return () => window.removeEventListener("notifications:unread", onUnreadUpdate);
  }, []);

  return (
    <>
      <aside className="card hidden w-full lg:block lg:w-64">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-moss">Holdbold</p>
          <h1 className="text-2xl font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            Dashboard
          </h1>
          <p className="text-sm text-ink/60">Alt samlet ét sted.</p>
        </div>
        <nav className="mt-6 flex flex-col gap-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const isNotifications = item.href === "/dashboard/notifikationer";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "border-ink/30 bg-white text-ink"
                    : "border-transparent bg-ink/5 text-ink/80 hover:border-ink/30 hover:bg-white"
                }`}
              >
                <span>{item.label}</span>
                {isNotifications && unreadCount > 0 ? (
                  <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink/10 bg-white/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-around px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink/70">
          {navItems.map((item) => {
            const isNotifications = item.href === "/dashboard/notifikationer";
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className="relative">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                    isActive ? "bg-ink text-fog shadow-sm" : "text-ink/60 hover:bg-ink/5"
                  }`}
                >
                  <span className="sr-only">{item.label}</span>
                  {icons[item.icon as keyof typeof icons]}
                </span>
                {isNotifications && unreadCount > 0 ? (
                  <span className="absolute -top-1 right-0 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
