import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function feedUrls(request: Request, token: string) {
  const origin = (process.env.NEXTAUTH_URL || new URL(request.url).origin).replace(/\/$/, "");
  const httpsUrl = `${origin}/api/calendar/feed/${token}`;
  return { httpsUrl, webcalUrl: httpsUrl.replace(/^https?:/, "webcal:") };
}

/** Returnerer brugerens kalenderfeed – opretter nøglen første gang. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { calendarToken: true } });
  if (!user) return NextResponse.json({ error: "Bruger ikke fundet" }, { status: 404 });

  let token = user.calendarToken;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    await prisma.user.update({ where: { id: session.user.id }, data: { calendarToken: token } });
  }
  return NextResponse.json(feedUrls(request, token));
}

/** Genererer en ny nøgle og gør dermed det gamle link ugyldigt. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }
  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { id: session.user.id }, data: { calendarToken: token } });
  return NextResponse.json(feedUrls(request, token));
}
