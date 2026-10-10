import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { feedNameFromUrl, fetchIcsText, importFeedEvents, normalizeIcalUrl, parseIcsEvents } from "@/lib/icalFeed";

const bodySchema = z.object({
  teamId: z.string().min(1),
  url: z
    .string()
    .min(1)
    .refine((value) => /^https?:\/\//i.test(value) || /^webcal:\/\//i.test(value), "Ugyldig URL"),
  name: z.string().min(1).optional()
});

const querySchema = z.object({
  teamId: z.string().min(1)
});

async function requireAdminForTeam(teamId: string, userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { teamId, userId, status: "ACTIVE" },
    select: { role: true }
  });
  return membership?.role === "ADMIN";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.parse({
    teamId: searchParams.get("teamId") ?? ""
  });

  const membership = await prisma.membership.findFirst({
    where: { teamId: parsed.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { id: true }
  });
  if (!membership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const feeds = await prisma.icalFeed.findMany({
    where: { teamId: parsed.teamId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ feeds });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
    }

    const json = await request.json();
    const body = bodySchema.parse(json);

    const canImport = await requireAdminForTeam(body.teamId, session.user.id);
    if (!canImport) {
      return NextResponse.json({ error: "Kun admin kan importere iCal" }, { status: 403 });
    }

    const normalizedUrl = normalizeIcalUrl(body.url);
    const feedName = body.name?.trim() || feedNameFromUrl(normalizedUrl);
    const fetched = await fetchIcsText(normalizedUrl);
    if (!fetched.ok) {
      return NextResponse.json({ error: "Kunne ikke hente iCal", details: fetched.details }, { status: 400 });
    }

    const events = parseIcsEvents(fetched.text);
    if (events.length === 0) {
      return NextResponse.json(
        {
          error: "Kunne ikke finde kampe i iCal",
          details: "Ingen VEVENT med UID og DTSTART blev fundet."
        },
        { status: 400 }
      );
    }

    const existingFeed = await prisma.icalFeed.findFirst({
      where: { teamId: body.teamId, url: normalizedUrl },
      select: { id: true }
    });

    const feed = existingFeed
      ? await prisma.icalFeed.update({
          where: { id: existingFeed.id },
          data: { name: feedName, lastImportedAt: new Date() }
        })
      : await prisma.icalFeed.create({
          data: { teamId: body.teamId, name: feedName, url: normalizedUrl, lastImportedAt: new Date() }
        });

    const result = await importFeedEvents({
      teamId: body.teamId,
      feedId: feed.id,
      events,
      actorId: session.user.id
    });

    return NextResponse.json({ ...result, feedId: feed.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ugyldigt input", details: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Ukendt fejl";
    console.error("iCal import failed", error);
    return NextResponse.json({ error: "Import fejlede", details: message }, { status: 500 });
  }
}

/** Fjerner et gemt feed fra overblikket. Kampene bliver liggende, men hentes ikke længere automatisk. */
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get("feedId") ?? "";
  if (!feedId) return NextResponse.json({ error: "feedId mangler" }, { status: 400 });

  const feed = await prisma.icalFeed.findUnique({ where: { id: feedId }, select: { id: true, teamId: true } });
  if (!feed) return NextResponse.json({ error: "Import ikke fundet" }, { status: 404 });

  if (!(await requireAdminForTeam(feed.teamId, session.user.id))) {
    return NextResponse.json({ error: "Kun admin kan slette importer" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.event.updateMany({ where: { feedId: feed.id }, data: { feedId: null } }),
    prisma.icalFeed.delete({ where: { id: feed.id } })
  ]);
  return NextResponse.json({ ok: true });
}
