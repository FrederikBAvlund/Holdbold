"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
        strokeWidth="1.7"
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
        strokeWidth="1.7"
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
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M6 17h12l-1.5-2V11a4.5 4.5 0 1 0-9 0v4L6 17Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10.4 3.4h3.2l.4 2a6.8 6.8 0 0 1 1.5.9l1.9-.8 2.3 2.3-.8 1.9c.36.46.66.96.9 1.5l2 .4v3.2l-2 .4a6.8 6.8 0 0 1-.9 1.5l.8 1.9-2.3 2.3-1.9-.8c-.46.36-.96.66-1.5.9l-.4 2h-3.2l-.4-2a6.8 6.8 0 0 1-1.5-.9l-1.9.8-2.3-2.3.8-1.9a6.8 6.8 0 0 1-.9-1.5l-2-.4v-3.2l2-.4c.24-.54.54-1.04.9-1.5l-.8-1.9 2.3-2.3 1.9.8c.46-.36.96-.66 1.5-.9l.4-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
};

export default function DashboardNav() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const sessionUserId = session?.user?.id;
  const hasActiveMembership = session?.user?.hasActiveMembership === true;
  const hasPendingMembership = session?.user?.hasPendingMembership === true;
  const pendingOnly = !hasActiveMembership && hasPendingMembership;
  const lastUnreadLoadRef = useRef<{ key: string; at: number } | null>(null);
  const unreadInFlightRef = useRef<Promise<void> | null>(null);

  const initials = useMemo(() => {
    const source = session?.user?.name?.trim() ?? "";
    if (!source) return "HB";
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase() ?? "")
      .join("");
  }, [session?.user?.name]);

  const visibleNavItems = useMemo(
    () =>
      pendingOnly
        ? navItems.filter((item) => item.href === "/dashboard/indstillinger")
        : navItems,
    [pendingOnly]
  );

  const loadCount = useCallback(async (reason = "default") => {
    if (!sessionUserId) return;
    const key = `${sessionUserId}:${reason}`;
    const now = Date.now();
    const last = lastUnreadLoadRef.current;
    if (last?.key === key && now - last.at < 1200) return;
    if (unreadInFlightRef.current) return unreadInFlightRef.current;
    lastUnreadLoadRef.current = { key, at: now };

    unreadInFlightRef.current = (async () => {
      try {
        const response = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setUnreadCount(data.count ?? 0);
      } finally {
        unreadInFlightRef.current = null;
      }
    })();

    return unreadInFlightRef.current;
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) return;
    loadCount(`route:${pathname}`);
  }, [sessionUserId, pathname, loadCount]);

  useEffect(() => {
    if (!sessionUserId) return;

    function onFocus() {
      loadCount("focus");
    }

    function onVisibilityChange() {
      if (!document.hidden) {
        loadCount("visibility");
      }
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [sessionUserId, loadCount]);

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
      <aside className="hidden lg:block lg:w-[286px] lg:shrink-0">
        <div className="card sticky top-6 flex h-[calc(100vh-3rem)] flex-col overflow-hidden px-5 py-6">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-moss">Holdbold</p>
            <h1 className="text-[2rem] font-semibold leading-none text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Dashboard
            </h1>
            <p className="text-sm text-ink/65">Kalender, bøder og hold samlet i et hurtigt overblik.</p>
          </div>

          <nav className="mt-7 flex flex-col gap-2.5">
            {visibleNavItems.map((item) => {
              const active = pathname === item.href;
              const isNotifications = item.href === "/dashboard/notifikationer";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center justify-between rounded-2xl border px-3.5 py-3 text-sm font-semibold transition ${
                    active
                      ? "border-ink/20 bg-white text-ink shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)]"
                      : "border-transparent bg-ink/5 text-ink/75 hover:border-ink/20 hover:bg-white/80 hover:text-ink"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                        active
                          ? "border-ink/20 bg-ink text-fog"
                          : "border-ink/10 bg-white/70 text-ink/70 group-hover:border-ink/20 group-hover:text-ink"
                      }`}
                    >
                      {icons[item.icon as keyof typeof icons]}
                    </span>
                    <span>{item.label}</span>
                  </span>
                  {isNotifications && unreadCount > 0 ? (
                    <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-ink/10 bg-white/65 px-3.5 py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink text-xs font-bold uppercase tracking-[0.12em] text-fog">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{session?.user?.name ?? "Holdbold bruger"}</p>
                <p className="truncate text-xs text-ink/60">{session?.user?.email ?? "Logget ind"}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1rem)] max-w-md -translate-x-1/2 lg:hidden">
        <div className="grid grid-cols-5 rounded-2xl border border-ink/15 bg-white/88 p-2 shadow-[0_24px_46px_-30px_rgba(15,23,42,0.65)] backdrop-blur">
          {visibleNavItems.map((item) => {
            const isNotifications = item.href === "/dashboard/notifikationer";
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className="relative flex items-center justify-center">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                    isActive
                      ? "border-ink/20 bg-ink text-fog shadow-[0_12px_20px_-14px_rgba(15,23,42,0.8)]"
                      : "border-transparent text-ink/65 hover:border-ink/15 hover:bg-white"
                  }`}
                >
                  <span className="sr-only">{item.label}</span>
                  {icons[item.icon as keyof typeof icons]}
                </span>
                {isNotifications && unreadCount > 0 ? (
                  <span className="absolute right-1 top-0 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
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
