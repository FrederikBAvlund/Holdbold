"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import Icon, { type IconName } from "@/components/ui/Icon";
import BrandMark from "@/components/ui/BrandMark";
import Avatar from "@/components/ui/Avatar";
import Sheet from "@/components/ui/Sheet";
import { CountBadge } from "@/components/ui/Button";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import { useRouter } from "next/navigation";
import { roleLabel } from "@/lib/roleLabels";

type NavItem = { href: string; label: string; icon: IconName };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Hjem", icon: "home" },
  { href: "/dashboard/kalender", label: "Kalender", icon: "calendar" },
  { href: "/dashboard/boder", label: "Bøder", icon: "receipt" },
  { href: "/dashboard/hold", label: "Hold", icon: "users" }
];

const SECONDARY_ITEMS: NavItem[] = [{ href: "/dashboard/fravaer", label: "Skade & fravær", icon: "heart" }];

const ADMIN_HREF = "/dashboard/admin";
const PROFILE_HREF = "/dashboard/profil";
const NOTIFICATIONS_HREF = "/dashboard/notifikationer";

function useUnreadCount(sessionUserId: string | undefined, pathname: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastLoadRef = useRef<{ key: string; at: number } | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const loadCount = useCallback(
    async (reason = "default") => {
      if (!sessionUserId) return;
      const key = `${sessionUserId}:${reason}`;
      const now = Date.now();
      const last = lastLoadRef.current;
      if (last?.key === key && now - last.at < 1200) return;
      if (inFlightRef.current) return inFlightRef.current;
      lastLoadRef.current = { key, at: now };
      inFlightRef.current = (async () => {
        try {
          const response = await fetch("/api/notifications/unread-count", { cache: "no-store" });
          if (!response.ok) return;
          const data = await response.json();
          setUnreadCount(data.count ?? 0);
        } finally {
          inFlightRef.current = null;
        }
      })();
      return inFlightRef.current;
    },
    [sessionUserId]
  );

  useEffect(() => {
    if (sessionUserId) loadCount(`route:${pathname}`);
  }, [sessionUserId, pathname, loadCount]);

  useEffect(() => {
    if (!sessionUserId) return;
    const onFocus = () => loadCount("focus");
    const onVisibility = () => {
      if (!document.hidden) loadCount("visibility");
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionUserId, loadCount]);

  useEffect(() => {
    const onUpdate = (event: Event) => setUnreadCount((event as CustomEvent<number>).detail ?? 0);
    window.addEventListener("notifications:unread", onUpdate);
    return () => window.removeEventListener("notifications:unread", onUpdate);
  }, []);

  return unreadCount;
}

type NavBadges = { fines: number; team: number; absences: number };
const NO_BADGES: NavBadges = { fines: 0, team: 0, absences: 0 };

/** Ting brugeren selv skal tage stilling til (rollebaseret) – uafhængigt af om notifikationerne er læst. */
function useNavBadges(teamId: string, seasonQuery: string, pathname: string) {
  const [badges, setBadges] = useState<NavBadges>(NO_BADGES);

  const load = useCallback(async () => {
    if (!teamId) {
      setBadges(NO_BADGES);
      return;
    }
    try {
      const response = await fetch(`/api/nav-badges?teamId=${teamId}${seasonQuery}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setBadges({
        fines: Number(data.fines) || 0,
        team: Number(data.team) || 0,
        absences: Number(data.absences) || 0
      });
    } catch {
      // badge er kun en hjælp – ignorér netværksfejl
    }
  }, [teamId, seasonQuery]);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    const onFines = (event: Event) => setBadges((prev) => ({ ...prev, fines: (event as CustomEvent<number>).detail ?? 0 }));
    const onRefresh = () => void load();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("fines:inbox", onFines);
    window.addEventListener("nav:refresh", onRefresh);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("fines:inbox", onFines);
      window.removeEventListener("nav:refresh", onRefresh);
    };
  }, [load]);

  return badges;
}

function TeamSwitcherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { memberships, teamId, setTeamId } = useDashboardTeam();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isSuperAdmin = session?.user?.isSuperAdmin === true;
  const adminActive = pathname.startsWith(ADMIN_HREF);
  return (
    <Sheet open={open} onClose={onClose} title="Skift hold" description="Vælg det hold, du vil se.">
      <div className="space-y-2">
        {isSuperAdmin ? (
          <button
            type="button"
            onClick={() => {
              router.push(ADMIN_HREF);
              onClose();
            }}
            className={cn(
              "flex min-h-[3.75rem] w-full items-center gap-3 rounded-2xl border px-4 text-left transition active:scale-[0.99]",
              adminActive ? "border-moss bg-moss/10" : "border-line hover:bg-ink/[0.03]"
            )}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-bg">
              <Icon name="settings" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">Admin</span>
              <span className="block text-sm text-ink/55">Opret og administrér hold</span>
            </span>
            {adminActive ? <Icon name="check" className="h-5 w-5 text-moss" strokeWidth={2.6} /> : null}
          </button>
        ) : null}
        {memberships.map((membership) => {
          const id = membership.team?.id ?? "";
          const active = id === teamId && !adminActive;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTeamId(id);
                if (adminActive) router.push("/dashboard");
                onClose();
              }}
              className={cn(
                "flex min-h-[3.75rem] w-full items-center gap-3 rounded-2xl border px-4 text-left transition active:scale-[0.99]",
                active ? "border-moss bg-moss/10" : "border-line hover:bg-ink/[0.03]"
              )}
            >
              <Avatar name={membership.team?.name ?? "Hold"} size="md" className="rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{membership.team?.name ?? "Hold"}</span>
                <span className="block text-sm text-ink/55">{roleLabel(membership.role)}</span>
              </span>
              {active ? <Icon name="check" className="h-5 w-5 text-moss" strokeWidth={2.6} /> : null}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export default function DashboardNav({
  serverUserName = null,
  serverUserEmail = null
}: {
  serverUserName?: string | null;
  serverUserEmail?: string | null;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { memberships, teamId, members, userId, seasonQuery } = useDashboardTeam();
  const [mounted, setMounted] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const unreadCount = useUnreadCount(session?.user?.id, pathname);
  const navBadges = useNavBadges(teamId, seasonQuery, pathname);
  const badgeFor = (href: string) =>
    href === "/dashboard/boder" ? navBadges.fines : href === "/dashboard/hold" ? navBadges.team : href === "/dashboard/fravaer" ? navBadges.absences : 0;

  const hasActiveMembership = session?.user?.hasActiveMembership === true;
  const hasPendingMembership = session?.user?.hasPendingMembership === true;
  const pendingOnly = !hasActiveMembership && hasPendingMembership;

  // useSession() mangler ofte name/email på første client-render, mens SSR har fuld session.
  const displayName = session?.user?.name?.trim() || serverUserName?.trim() || "";
  const displayEmail = session?.user?.email?.trim() || serverUserEmail?.trim() || "";
  const myImage = members.find((member) => member.user.id === userId)?.user.image ?? null;

  const activeTeam = useMemo(
    () => memberships.find((membership) => membership.team?.id === teamId) ?? memberships[0],
    [memberships, teamId]
  );
  const teamName = pathname.startsWith(ADMIN_HREF) && session?.user?.isSuperAdmin
    ? "Admin"
    : activeTeam?.team?.name ?? "Holdbold";
  const isSuperAdmin = session?.user?.isSuperAdmin === true;
  const canSwitchTeam = memberships.length > 1 || isSuperAdmin;

  const items = pendingOnly ? [] : NAV_ITEMS;
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => setMounted(true), []);

  const teamButton = (
    <button
      type="button"
      onClick={() => canSwitchTeam && setTeamSheetOpen(true)}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-2xl py-1 pr-2 text-left",
        canSwitchTeam && "transition active:scale-[0.98]"
      )}
      aria-label={canSwitchTeam ? `Aktivt hold: ${teamName}. Tryk for at skifte` : teamName}
    >
      <BrandMark className="h-9 w-9" />
      <span className="min-w-0 leading-none">
        <span className="block text-[0.625rem] font-bold uppercase tracking-[0.16em] text-ink/45">Holdbold</span>
        <span className="mt-0.5 flex items-center gap-1 font-display text-lg font-bold uppercase leading-none text-ink">
          <span className="truncate">{teamName}</span>
          {canSwitchTeam ? <Icon name="chevron-down" className="h-4 w-4 text-ink/45" strokeWidth={2.4} /> : null}
        </span>
      </span>
    </button>
  );

  const actions = (
    <div className="flex shrink-0 items-center gap-1.5">
      <Link
        href={NOTIFICATIONS_HREF}
        aria-label={unreadCount > 0 ? `Notifikationer, ${unreadCount} ulæste` : "Notifikationer"}
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95",
          pathname.startsWith(NOTIFICATIONS_HREF) ? "bg-ink text-bg" : "bg-ink/[0.06] text-ink hover:bg-ink/10"
        )}
      >
        <Icon name="bell" />
        {unreadCount > 0 ? <CountBadge count={unreadCount} className="absolute -right-1 -top-1" /> : null}
      </Link>
      <Link href={PROFILE_HREF} aria-label="Profil og indstillinger" className="rounded-full transition active:scale-95">
        <Avatar
          name={displayName || "?"}
          image={myImage}
          size="md"
          className={cn(pathname.startsWith(PROFILE_HREF) && "ring-2 ring-moss ring-offset-2 ring-offset-bg")}
        />
      </Link>
    </div>
  );

  // Svævende dock: aktiv fane udvider sig til ikon + tekst, de øvrige er kun ikoner.
  const bottomNav = (
    <nav
      aria-label="Hovednavigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] lg:hidden"
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-1 rounded-full border border-line bg-surface/85 p-1.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={badgeFor(item.href) > 0 ? `${item.label}, ${badgeFor(item.href)} venter` : item.label}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-full transition-all duration-300 ease-out active:scale-95",
                active
                  ? "flex-[2.2] bg-primary px-4 text-on-primary shadow-[0_8px_20px_-10px_var(--primary)]"
                  : "flex-1 text-ink/55 hover:text-ink"
              )}
            >
              <span className="relative inline-flex">
                <Icon name={item.icon} className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} />
                {badgeFor(item.href) > 0 ? (
                  <CountBadge count={badgeFor(item.href)} className="absolute -right-2.5 -top-2" />
                ) : null}
              </span>
              {active ? (
                <span className="animate-fade-in font-display text-base font-bold uppercase tracking-wide">
                  {item.label}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobil topbar */}
      <header className="sticky top-0 z-40 -mx-3 flex items-center justify-between gap-3 bg-bg px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] shadow-[0_1px_0_var(--line)] sm:-mx-5 sm:px-5 lg:hidden">
        {teamButton}
        {actions}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:w-[260px] lg:shrink-0">
        <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col rounded-[1.75rem] border border-line bg-surface p-3 shadow-[var(--shadow-sm)]">
          <div className="px-2 pb-4 pt-2">{teamButton}</div>
          <nav className="flex flex-1 flex-col gap-1" aria-label="Hovednavigation">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-3.5 font-display text-lg font-bold uppercase tracking-wide transition",
                    active ? "bg-primary text-on-primary" : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink"
                  )}
                >
                  <Icon name={item.icon} />
                  <span className="flex-1">{item.label}</span>
                  {badgeFor(item.href) > 0 ? <CountBadge count={badgeFor(item.href)} className="ring-0" /> : null}
                </Link>
              );
            })}
            {(pendingOnly ? [] : SECONDARY_ITEMS).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-3.5 font-display text-lg font-bold uppercase tracking-wide transition",
                  isActive(item.href) ? "bg-primary text-on-primary" : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink"
                )}
              >
                <Icon name={item.icon} />
                <span className="flex-1">{item.label}</span>
                {badgeFor(item.href) > 0 ? <CountBadge count={badgeFor(item.href)} className="ring-0" /> : null}
              </Link>
            ))}
            <Link
              href={NOTIFICATIONS_HREF}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl px-3.5 font-display text-lg font-bold uppercase tracking-wide transition",
                pathname.startsWith(NOTIFICATIONS_HREF)
                  ? "bg-primary text-on-primary"
                  : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink"
              )}
            >
              <Icon name="bell" />
              <span className="flex-1">Notifikationer</span>
              {unreadCount > 0 ? <CountBadge count={unreadCount} className="ring-0" /> : null}
            </Link>
          </nav>
          <Link href={PROFILE_HREF} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-ink/[0.04]">
            <Avatar name={displayName || "?"} image={myImage} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{displayName || "Din profil"}</span>
              <span className="block truncate text-xs text-ink/55">{displayEmail || ""}</span>
            </span>
            <Icon name="settings" className="h-4 w-4 text-ink/40" />
          </Link>
        </div>
      </aside>

      {mounted && items.length > 0 ? createPortal(bottomNav, document.body) : null}
      <TeamSwitcherSheet open={teamSheetOpen} onClose={() => setTeamSheetOpen(false)} />
    </>
  );
}
