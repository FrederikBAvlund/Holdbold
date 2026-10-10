"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { EmptyState, FilterChips, PageHeader, Skeleton } from "@/components/ui/primitives";
import { dayDiff, formatRelativePast } from "@/lib/format";

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
  type: string;
};

type Filter = "all" | "unread";

const TYPE_ICON: Record<string, { icon: IconName; tone: string }> = {
  EVENT: { icon: "calendar", tone: "bg-primary/12 text-moss" },
  FINE: { icon: "receipt", tone: "bg-warning/15 text-warning" },
  FINE_PROPOSED: { icon: "receipt", tone: "bg-pending/15 text-pending" },
  FINE_SYSTEM: { icon: "receipt", tone: "bg-warning/15 text-warning" },
  GENERAL: { icon: "bell", tone: "bg-ink/[0.07] text-ink/70" }
};

function groupLabel(value: string) {
  const diff = dayDiff(value);
  if (diff === 0) return "I dag";
  if (diff === -1) return "I går";
  if (diff > -7) return "Denne uge";
  return "Tidligere";
}

function broadcastUnread(count: number) {
  window.dispatchEvent(new CustomEvent("notifications:unread", { detail: count }));
}

export default function NotifikationerPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const userId = session?.user?.id;

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/notifications${showAll ? "" : "?days=7"}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.notifications ?? []);
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, [showAll]);

  useEffect(() => {
    if (!userId) return;
    void load();
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, load]);

  const unreadCount = useMemo(() => (items ?? []).filter((item) => !item.readAt).length, [items]);

  const groups = useMemo(() => {
    const visible = (items ?? []).filter((item) => filter === "all" || !item.readAt);
    const result: { label: string; items: NotificationItem[] }[] = [];
    for (const item of visible) {
      const label = groupLabel(item.createdAt);
      const last = result[result.length - 1];
      if (last && last.label === label) last.items.push(item);
      else result.push({ label, items: [item] });
    }
    return result;
  }, [items, filter]);

  async function open(notification: NotificationItem) {
    if (!notification.readAt) {
      setItems((prev) =>
        (prev ?? []).map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
      );
      fetch(`/api/notifications/${notification.id}/read`, { method: "POST" })
        .then((response) => response.json())
        .then((data) => broadcastUnread(data.unreadCount ?? 0))
        .catch(() => undefined);
    }
    if (notification.link) router.push(notification.link);
  }

  async function markAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      setItems((prev) => (prev ?? []).map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      broadcastUnread(data.unreadCount ?? 0);
    } finally {
      setMarkingAll(false);
    }
  }

  if (sessionStatus !== "loading" && !userId) {
    return <p className="pt-4 text-ink/70">Du skal være logget ind for at se notifikationer.</p>;
  }

  return (
    <div className="space-y-5 pb-8 pt-1">
      <PageHeader
        title="Notifikationer"
        subtitle={unreadCount > 0 ? `${unreadCount} ulæst${unreadCount === 1 ? "" : "e"}` : "Du er helt opdateret"}
        action={
          unreadCount > 0 ? (
            <Button variant="secondary" size="sm" icon="check" onClick={markAllRead} loading={markingAll}>
              Læs alle
            </Button>
          ) : undefined
        }
      />

      <FilterChips<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Alle" },
          { value: "unread", label: "Ulæste", count: unreadCount }
        ]}
      />

      {items === null ? (
        <div className="space-y-2">
          <Skeleton className="h-20 rounded-[1.375rem]" />
          <Skeleton className="h-20 rounded-[1.375rem]" />
          <Skeleton className="h-20 rounded-[1.375rem]" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="bell"
          title={filter === "unread" ? "Ingen ulæste" : "Ingen notifikationer endnu"}
          description={
            filter === "unread"
              ? "Alt er læst. Flot!"
              : "Her dukker nye begivenheder og bøder op, så du ikke går glip af noget."
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} className="space-y-2">
              <h2 className="px-1 font-display text-lg font-bold uppercase tracking-wide text-ink/70">{group.label}</h2>
              <ul className="stagger divide-y divide-line overflow-hidden rounded-[1.375rem] border border-line bg-surface">
                {group.items.map((item) => {
                  const meta = TYPE_ICON[item.type] ?? TYPE_ICON.GENERAL;
                  const unread = !item.readAt;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => open(item)}
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-ink/[0.03] active:bg-ink/[0.06]"
                      >
                        <span className={cn("mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
                          <Icon name={meta.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className={cn("text-[0.95rem] leading-snug text-ink", unread ? "font-bold" : "font-semibold text-ink/80")}>
                              {item.title}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-ink/45">
                              {formatRelativePast(item.createdAt)}
                              {unread ? <span aria-label="Ulæst" className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                            </span>
                          </span>
                          {item.body ? <span className="mt-0.5 block text-sm text-ink/60">{item.body}</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {items !== null && !showAll ? (
        <Button variant="secondary" block onClick={() => setShowAll(true)}>
          Vis ældre notifikationer
        </Button>
      ) : null}
    </div>
  );
}
