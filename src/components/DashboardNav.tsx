"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Overblik", shortLabel: "Overblik", icon: "home" },
  { href: "/dashboard/kalender", label: "Kalender", shortLabel: "Kalender", icon: "calendar" },
  { href: "/dashboard/boder", label: "Bøder", shortLabel: "Bøder", icon: "receipt" },
  { href: "/dashboard/notifikationer", label: "Notifikationer", shortLabel: "Notif.", icon: "bell" },
  { href: "/dashboard/indstillinger", label: "Indstillinger", shortLabel: "Indstill.", icon: "settings" }
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
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  )
};

function initialsFromDisplayName(name: string) {
  const source = name.trim();
  if (!source) return "HB";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

export default function DashboardNav({
  serverUserName = null,
  serverUserEmail = null
}: {
  serverUserName?: string | null;
  serverUserEmail?: string | null;
}) {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileNavMounted, setMobileNavMounted] = useState(false);
  const pathname = usePathname();
  const sessionUserId = session?.user?.id;
  const hasActiveMembership = session?.user?.hasActiveMembership === true;
  const hasPendingMembership = session?.user?.hasPendingMembership === true;
  const pendingOnly = !hasActiveMembership && hasPendingMembership;
  const lastUnreadLoadRef = useRef<{ key: string; at: number } | null>(null);
  const unreadInFlightRef = useRef<Promise<void> | null>(null);

  // useSession() mangler ofte name/email på første client-render (SessionProvider refetch),
  // mens SSR har fuld session → hydration mismatch. Server props er identiske på SSR og hydrering.
  const displayName = session?.user?.name?.trim() || serverUserName?.trim() || "";
  const displayEmail = session?.user?.email?.trim() || serverUserEmail?.trim() || "";

  const initials = useMemo(() => initialsFromDisplayName(displayName), [displayName]);

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

  useEffect(() => {
    setMobileNavMounted(true);
  }, []);

  const isItemActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const currentItem = visibleNavItems.find((item) => isItemActive(item.href));

  const unreadBadge = (className: string) =>
    unreadCount > 0 ? (
      <span
        className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-surface ${className}`}
      >
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    ) : null;

  const mobileNavBar = (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.6rem,calc(env(safe-area-inset-bottom,0px)+2px))] lg:hidden"
      aria-label="Hovednavigation"
    >
      <div className="pointer-events-auto w-full max-w-md">
        <div className="grid grid-cols-5 gap-0.5 rounded-[1.75rem] border border-ink/10 bg-[color:var(--surface)] p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-xl">
          {visibleNavItems.map((item) => {
            const isNotifications = item.href === "/dashboard/notifikationer";
            const isActive = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] px-0.5 py-1 transition active:scale-95 ${
                  isActive ? "bg-primary text-on-primary" : "text-ink/60 hover:text-ink"
                }`}
              >
                <span className="relative flex h-6 w-6 items-center justify-center">
                  {icons[item.icon as keyof typeof icons]}
                  {isNotifications ? unreadBadge("absolute -right-2 -top-1.5") : null}
                </span>
                <span className="text-nav-label max-w-[4.5rem] truncate text-center">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-40 -mx-3 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top,0px))] backdrop-blur-xl sm:-mx-5 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-sm font-bold text-on-primary">
            H
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-ink/50">Holdbold</p>
            <h1 className="truncate font-display text-base font-bold text-ink">
              {currentItem?.label ?? "Dashboard"}
            </h1>
          </div>
        </div>
        <Link
          href="/dashboard/indstillinger"
          aria-label="Din profil og indstillinger"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold uppercase text-ink ring-1 ring-ink/10"
        >
          {initials}
        </Link>
      </header>

      <aside className="hidden lg:block lg:w-[280px] lg:shrink-0">
        <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-app border border-ink/10 bg-surface shadow-[var(--shadow-sm)]">
          <div className="flex shrink-0 items-center gap-3 px-5 pb-4 pt-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary font-display text-lg font-bold text-on-primary">
              H
            </span>
            <div className="leading-tight">
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">Holdbold</h1>
              <p className="text-xs text-ink/55">Kalender, bøder og hold</p>
            </div>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
            {visibleNavItems.map((item) => {
              const active = isItemActive(item.href);
              const isNotifications = item.href === "/dashboard/notifikationer";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center justify-between rounded-control px-3 py-2.5 text-sm font-semibold transition ${
                    active ? "bg-primary text-on-primary" : "text-ink/70 hover:bg-ink/[0.05] hover:text-ink"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {icons[item.icon as keyof typeof icons]}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {isNotifications ? unreadBadge("") : null}
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-ink/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase tracking-wide text-on-primary">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{displayName || "Holdbold bruger"}</p>
                <p className="truncate text-xs text-ink/55">{displayEmail || "Logget ind"}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {mobileNavMounted ? createPortal(mobileNavBar, document.body) : null}
    </>
  );
}
