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

  const mobileNavBar = (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.78rem,calc(env(safe-area-inset-bottom,0px)+2px))] lg:hidden"
      aria-label="Hovednavigation"
    >
      <div className="pointer-events-auto w-full max-w-md">
        <div className="grid grid-cols-5 gap-1 rounded-[1.35rem] border border-ink/10 bg-fog/95 p-2 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04] backdrop-blur-xl">
          {visibleNavItems.map((item) => {
            const isNotifications = item.href === "/dashboard/notifikationer";
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`relative flex min-h-[3.4rem] min-w-0 flex-col items-center justify-center gap-1 rounded-control px-0.5 py-1 transition-colors duration-150 ${
                  isActive ? "bg-moss/14 text-moss" : "text-ink/65 hover:bg-ink/[0.04]"
                }`}
              >
                <span
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-control border transition ${
                    isActive
                      ? "border-moss/40 bg-moss text-fog shadow-md"
                      : "border-transparent bg-ink/[0.05] text-ink/70"
                  }`}
                >
                  {icons[item.icon as keyof typeof icons]}
                </span>
                <span className="text-nav-label max-w-[4.25rem] truncate text-center">{item.shortLabel}</span>
                {isNotifications && unreadCount > 0 ? (
                  <span className="absolute right-0.5 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-[308px] lg:shrink-0">
        <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-app border border-ink/10 bg-fog/95 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="relative shrink-0 overflow-hidden px-5 pb-6 pt-7">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.97]"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, var(--color-moss) 92%, black) 0%, var(--color-button) 55%, color-mix(in srgb, var(--color-moss) 75%, var(--color-button)) 100%)`
              }}
            />
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
            <div className="relative space-y-2 text-fog">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/75">Holdbold</p>
              <h1 className="font-display text-[1.85rem] font-bold leading-[1.1] tracking-tight">Dashboard</h1>
              <p className="max-w-[16rem] text-sm leading-snug text-white/88">
                Kalender, bøder og hold samlet i ét overblik.
              </p>
            </div>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
            {visibleNavItems.map((item) => {
              const active = pathname === item.href;
              const isNotifications = item.href === "/dashboard/notifikationer";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center justify-between rounded-control border px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "border-moss/20 bg-white text-ink shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] ring-1 ring-moss/15"
                      : "border-transparent text-ink/78 hover:bg-white/70 hover:text-ink"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control border transition ${
                        active
                          ? "border-moss/30 bg-moss text-fog shadow-sm"
                          : "border-ink/10 bg-white text-ink/65 group-hover:border-moss/25 group-hover:text-ink"
                      }`}
                    >
                      {icons[item.icon as keyof typeof icons]}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {isNotifications && unreadCount > 0 ? (
                    <span className="inline-flex min-w-[22px] shrink-0 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-ink/10 bg-white/55 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-moss to-[color:var(--color-button)] text-xs font-bold uppercase tracking-wide text-fog shadow-md ring-2 ring-white/90">
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
