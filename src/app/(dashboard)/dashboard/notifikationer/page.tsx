"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
  type: string;
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}.${pad(
    date.getMonth() + 1
  )}.${date.getFullYear()}`;
}

export default function NotifikationerPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const router = useRouter();
  const loadedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadNotifications() {
      const sessionUserId = session?.user?.id;
      if (!sessionUserId) {
        loadedForUserRef.current = null;
        return;
      }
      if (loadedForUserRef.current === sessionUserId) return;
      loadedForUserRef.current = sessionUserId;

      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.notifications ?? []);
    }

    loadNotifications();
  }, [session?.user?.id]);

  const [unread, read] = useMemo(() => {
    const unreadItems = items.filter((item) => !item.readAt);
    const readItems = items.filter((item) => item.readAt);
    return [unreadItems, readItems];
  }, [items]);

  async function handleOpen(notification: NotificationItem) {
    if (!notification.readAt) {
      const response = await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" });
      const data = await response.json();
      setItems((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notifications:unread", { detail: data.unreadCount ?? 0 }));
      }
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications/read-all", { method: "POST" });
    const data = await response.json();
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("notifications:unread", { detail: data.unreadCount ?? 0 }));
    }
  }

  if (sessionStatus === "loading") {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Notifikationer</h2>
        <p className="mt-2 text-ink/70">Indlæser...</p>
      </section>
    );
  }

  if (!session?.user?.id) {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Notifikationer</h2>
        <p className="mt-2 text-ink/70">Du skal være logget ind for at se notifikationer.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Notifikationer</h2>
            <p className="mt-2 text-ink/70">Log over nye begivenheder og bøder.</p>
          </div>
          <button className="btn-ghost" onClick={markAllRead}>
            Marker alle som læst
          </button>
        </div>
      </header>

      <div className="space-y-4">
        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Ulæste</h3>
          <div className="mt-4 space-y-3">
            {unread.length === 0 ? <p className="text-sm text-ink/70">Ingen ulæste notifikationer.</p> : null}
            {unread.map((item) => (
              <button
                key={item.id}
                onClick={() => handleOpen(item)}
                className="flex w-full items-start gap-3 rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-left shadow-sm transition hover:border-ink/30"
              >
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <span className="text-xs text-ink/50">{formatTimestamp(item.createdAt)}</span>
                  </div>
                  {item.body ? <p className="mt-1 text-sm text-ink/70">{item.body}</p> : null}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Læste</h3>
          <div className="mt-4 space-y-3">
            {read.length === 0 ? <p className="text-sm text-ink/70">Ingen læste notifikationer.</p> : null}
            {read.map((item) => (
              <button
                key={item.id}
                onClick={() => handleOpen(item)}
                className="flex w-full items-start gap-3 rounded-2xl border border-transparent bg-white/70 px-4 py-3 text-left transition hover:border-ink/20"
              >
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-ink/20" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <span className="text-xs text-ink/50">{formatTimestamp(item.createdAt)}</span>
                  </div>
                  {item.body ? <p className="mt-1 text-sm text-ink/70">{item.body}</p> : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
