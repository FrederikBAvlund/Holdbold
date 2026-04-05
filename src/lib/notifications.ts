import type { NotificationType } from "@prisma/client";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

type NotificationInput = {
  userId: string;
  teamId?: string | null;
  type?: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
};

let webPushConfigured = false;

function configureWebPush() {
  if (webPushConfigured) return true;
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT ?? "mailto:tech@holdbold.dk",
    publicKey,
    privateKey
  );
  webPushConfigured = true;
  return true;
}

function toAbsoluteUrl(path?: string | null) {
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://holdbold.dk";
  if (!path) return `${baseUrl}/dashboard/notifikationer`;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function sendPushForNotifications(notifications: NotificationInput[]) {
  if (!configureWebPush()) return;
  if (notifications.length === 0) return;

  const userIds = Array.from(new Set(notifications.map((item) => item.userId)));
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } }
  });

  if (subscriptions.length === 0) return;

  const subscriptionsByUser = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions) {
    const list = subscriptionsByUser.get(subscription.userId) ?? [];
    list.push(subscription);
    subscriptionsByUser.set(subscription.userId, list);
  }

  const tasks: Promise<void>[] = [];

  for (const notification of notifications) {
    const recipients = subscriptionsByUser.get(notification.userId) ?? [];
    if (recipients.length === 0) continue;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body ?? "",
      url: toAbsoluteUrl(notification.link),
      icon: "/icon",
      badge: "/icon"
    });

    for (const recipient of recipients) {
      tasks.push(
        webpush
          .sendNotification(
            {
              endpoint: recipient.endpoint,
              keys: {
                p256dh: recipient.p256dh,
                auth: recipient.auth
              }
            },
            payload
          )
          .then(() => undefined)
          .catch(async (error: unknown) => {
            const statusCode =
              typeof error === "object" && error !== null && "statusCode" in error
                ? Number((error as { statusCode?: number }).statusCode)
                : undefined;
            if (statusCode === 404 || statusCode === 410) {
              await prisma.pushSubscription
                .delete({ where: { endpoint: recipient.endpoint } })
                .catch(() => undefined);
            }
          })
      );
    }
  }

  await Promise.all(tasks);
}

export async function createNotifications(notifications: NotificationInput[]) {
  if (notifications.length === 0) return;

  await prisma.notification.createMany({ data: notifications });
  await sendPushForNotifications(notifications);
}

